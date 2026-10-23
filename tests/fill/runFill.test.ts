import { fakerDE } from '@faker-js/faker'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDataset, ensureSlots, type Dataset } from '../../src/generators/dataset'
import { createOwnership } from '../../src/fill/ownership'
import { runFill } from '../../src/fill/runFill'
import type { DataTypeConfig, FieldRule, Template } from '../../src/model/types'

function rule(id: string, config: DataTypeConfig, extra: Partial<FieldRule> = {}): FieldRule {
  return { id, label: `Feld ${id}`, locator: { kind: 'text', name: id }, config, slot: null, required: true, appendRunId: false, ...extra }
}

function template(fields: FieldRule[]): Template {
  return { id: 't1', appId: 'app', name: 'Vorlage', process: null, fields, lastMissing: [] }
}

function input(name: string): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>(`[name="${name}"]`)
  if (!el) throw new Error(`missing ${name}`)
  return el
}

let ds: Dataset

beforeEach(() => {
  fakerDE.seed(42)
  document.body.innerHTML = ''
  ds = createDataset(fakerDE)
})

describe('runFill', () => {
  it('fills fields in template order and reports missing ones without stopping', async () => {
    document.body.innerHTML = '<input name="company"><input name="first">'
    const t = template([
      rule('company', { type: 'companyName' }),
      rule('gone', { type: 'fixed', value: 'x' }),
      rule('first', { type: 'firstName' }),
    ])
    const report = await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE)

    expect(input('company').value).toBe(ds.company.name)
    expect(input('first').value).toBe(ds.persons['1']?.firstName)
    expect(report.templateId).toBe('t1')
    expect(report.fields.map((f) => [f.fieldId, f.status])).toEqual([
      ['company', 'filled'],
      ['gone', 'missing'],
      ['first', 'filled'],
    ])
    expect(report.fields[1]?.label).toBe('Feld gone')
    expect(report.filled).toBe(2)
    expect(report.total).toBe(3)
  })

  it('waits a frame between fields so conditionally rendered fields appear', async () => {
    document.body.innerHTML = '<input name="trigger">'
    input('trigger').addEventListener('input', () => {
      requestAnimationFrame(() => {
        if (document.querySelector('[name="late"]')) return
        const late = document.createElement('input')
        late.name = 'late'
        document.body.append(late)
      })
    })
    const t = template([rule('trigger', { type: 'fixed', value: 'ja' }), rule('late', { type: 'fixed', value: 'da' })])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.fields.map((f) => f.status)).toEqual(['filled', 'filled'])
    expect(input('late').value).toBe('da')
  })

  it('mode required fills only required fields and skips the rest', async () => {
    document.body.innerHTML = '<input name="a"><input name="b" value="unverändert"><input name="c">'
    const t = template([
      rule('a', { type: 'fixed', value: 'A' }),
      rule('b', { type: 'fixed', value: 'B' }, { required: false }),
      rule('c', { type: 'fixed', value: 'C' }),
    ])
    const report = await runFill(document.body, t, ds, 'required', fakerDE)
    expect(input('a').value).toBe('A')
    expect(input('b').value).toBe('unverändert')
    expect(input('c').value).toBe('C')
    expect(report.fields[1]).toEqual({ fieldId: 'b', label: 'Feld b', status: 'skipped', detail: 'Optional' })
    expect(report.filled).toBe(2)
    expect(report.total).toBe(2)
  })

  it('reports empty rules as skipped with a reason', async () => {
    document.body.innerHTML = '<input name="e" value="x">'
    const report = await runFill(document.body, template([rule('e', { type: 'empty' })]), ds, 'all', fakerDE)
    expect(report.fields).toEqual([{ fieldId: 'e', label: 'Feld e', status: 'skipped', detail: 'Leer lassen' }])
    expect(input('e').value).toBe('x')
    expect(report.total).toBe(0)
  })

  it('reports rules with incomplete options as failed without touching the field', async () => {
    document.body.innerHTML = '<input name="l" value="y"><input name="p" value="y"><input name="f" value="y">'
    const t = template([
      rule('l', { type: 'list', values: [] }),
      rule('p', { type: 'pattern', pattern: '' }),
      rule('f', { type: 'fixed', value: '' }),
    ])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.fields.map((f) => f.status)).toEqual(['failed', 'failed', 'failed'])
    expect(report.fields[0]?.detail).toMatch(/^Optionen unvollständig: /)
    expect(['l', 'p', 'f'].map((n) => input(n).value)).toEqual(['y', 'y', 'y'])
    expect(report.filled).toBe(0)
    expect(report.total).toBe(3)
  })

  it('reports ambiguous fields', async () => {
    document.body.innerHTML = '<input name="dup"><input name="dup">'
    const report = await runFill(document.body, template([rule('dup', { type: 'fixed', value: 'x' })]), ds, 'all', fakerDE)
    expect(report.fields[0]?.status).toBe('ambiguous')
    expect(report.fields[0]?.detail).toContain('2')
  })

  it('reports a field as failed when resolving throws and continues', async () => {
    document.body.innerHTML = '<input name="p"><input name="ok">'
    const t = template([
      rule('p', { type: 'firstName' }, { slot: '9' }),
      rule('ok', { type: 'fixed', value: 'ok' }),
    ])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.fields[0]?.status).toBe('failed')
    expect(report.fields[0]?.detail).toBeTruthy()
    expect(input('ok').value).toBe('ok')
    expect(report.filled).toBe(1)
  })

  it('reports fill failures with the reason from the filler', async () => {
    document.body.innerHTML = '<select name="s"><option>Eins</option></select>'
    const t = template([rule('s', { type: 'choice', mode: 'fixed', values: ['Zwei'] }, { locator: { kind: 'select', name: 's' } })])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.fields[0]?.status).toBe('failed')
    expect(report.fields[0]?.detail).toBeTruthy()
  })

  it('appends the run id within the maxlength of the element', async () => {
    document.body.innerHTML = '<input name="n" maxlength="12"><input name="free">'
    const t = template([
      rule('n', { type: 'fixed', value: 'Mustermann GmbH' }, { appendRunId: true }),
      rule('free', { type: 'fixed', value: 'Mustermann GmbH' }, { appendRunId: true }),
    ])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.filled).toBe(2)
    expect(input('n').value).toBe(`Must · ${ds.runId}`)
    expect(input('free').value).toBe(`Mustermann GmbH · ${ds.runId}`)
  })
})

describe('runFill – own values', () => {
  it('keeps a field with a foreign value and reports it as kept', async () => {
    document.body.innerHTML = '<input name="company"><input name="first">'
    input('company').value = 'Kunde 4711'
    const t = template([rule('company', { type: 'companyName' }), rule('first', { type: 'firstName' })])
    const report = await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE, createOwnership())
    expect(input('company').value).toBe('Kunde 4711')
    expect(report.fields[0]).toMatchObject({ status: 'kept', detail: 'Bereits ausgefüllt' })
    expect(report.filled).toBe(1)
    expect(report.total).toBe(2)
  })

  it('fills empty fields and its own values, keeps a text field the page preset', async () => {
    document.body.innerHTML = '<input name="company"><input name="first" value="Vorbelegt">'
    const t = template([rule('company', { type: 'companyName' }), rule('first', { type: 'firstName' })])
    const own = createOwnership()
    const first = await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE, own)
    expect(first.fields.map((f) => f.status)).toEqual(['filled', 'kept'])
    expect(input('company').value).toBe(ds.company.name)
    fakerDE.seed(7)
    const other = createDataset(fakerDE)
    const second = await runFill(document.body, t, ensureSlots(other, t, fakerDE), 'all', fakerDE, own)
    expect(second.fields.map((f) => f.status)).toEqual(['filled', 'kept'])
    expect(input('company').value).toBe(other.company.name)
    expect(input('first').value).toBe('Vorbelegt')
  })

  it('fills choice controls that still show what the page preset, by HTML or by script', async () => {
    document.body.innerHTML = `
      <select name="industry"><option value="it">IT</option><option value="bau">Bau</option></select>
      <label><input type="radio" name="role" value="a"> A</label><label><input type="radio" name="role" value="b"> B</label>
      <input type="checkbox" name="agb" checked><input type="checkbox" name="news">`
    const select = document.querySelector<HTMLSelectElement>('select')
    if (!select) throw new Error('missing select')
    select.value = 'bau'
    input('news').checked = true
    document.querySelector<HTMLInputElement>('[value="b"]')!.checked = true
    const t = template([
      rule('industry', { type: 'choice', mode: 'fixed', values: ['IT'] }, { locator: { kind: 'select', name: 'industry' } }),
      rule('role', { type: 'choice', mode: 'fixed', values: ['A'] }, { locator: { kind: 'radiogroup', name: 'role' } }),
      rule('agb', { type: 'checkbox', checked: false }, { locator: { kind: 'checkbox', name: 'agb' } }),
      rule('news', { type: 'checkbox', checked: false }, { locator: { kind: 'checkbox', name: 'news' } }),
    ])
    const report = await runFill(document.body, t, ds, 'all', fakerDE, createOwnership())
    expect(report.fields.map((f) => f.status)).toEqual(['filled', 'filled', 'filled', 'filled'])
    expect(select.value).toBe('it')
    expect(document.querySelector<HTMLInputElement>('[value="a"]')?.checked).toBe(true)
    expect(input('agb').checked).toBe(false)
    expect(input('news').checked).toBe(false)
  })

  it('keeps a choice made by hand after the first run, also in a combobox that was empty at first contact', async () => {
    document.body.innerHTML = `
      <input type="checkbox" name="news">
      <div role="combobox" id="cb" tabindex="0" aria-controls="lb"><span id="shown"></span></div>
      <ul role="listbox" id="lb" hidden><li role="option">Deutschland</li><li role="option">Österreich</li></ul>`
    const shown = document.querySelector<HTMLElement>('#shown')!
    const lb = document.querySelector<HTMLElement>('#lb')!
    document.querySelector<HTMLElement>('#cb')!.addEventListener('click', () => { lb.hidden = false })
    for (const li of document.querySelectorAll<HTMLElement>('li')) {
      li.addEventListener('mousedown', () => { shown.textContent = li.textContent; lb.hidden = true })
    }
    const t = template([
      rule('news', { type: 'checkbox', checked: false }, { locator: { kind: 'checkbox', name: 'news' } }),
      rule('country', { type: 'choice', mode: 'fixed', values: ['Deutschland'] }, { locator: { kind: 'combobox', id: 'cb' } }),
    ])
    const own = createOwnership()
    const first = await runFill(document.body, t, ds, 'all', fakerDE, own)
    expect(first.fields.map((f) => f.status)).toEqual(['filled', 'filled'])
    expect(shown.textContent).toBe('Deutschland')

    input('news').checked = true
    shown.textContent = 'Österreich'
    const second = await runFill(document.body, t, ds, 'all', fakerDE, own)
    expect(second.fields.map((f) => f.status)).toEqual(['kept', 'kept'])
    expect(input('news').checked).toBe(true)
    expect(shown.textContent).toBe('Österreich')
  })

  it('records before and written state for undo', async () => {
    document.body.innerHTML = '<input name="company">'
    const t = template([rule('company', { type: 'companyName' })])
    const own = createOwnership()
    await runFill(document.body, t, ds, 'all', fakerDE, own)
    fakerDE.seed(7)
    const other = createDataset(fakerDE)
    await runFill(document.body, t, other, 'all', fakerDE, own)
    expect(own.lastRun()).toMatchObject([
      { fieldId: 'company', label: 'Feld company', kind: 'text', key: '{"kind":"text","name":"company"}', before: ds.company.name, written: other.company.name },
    ])
  })

  it('continues the last run when asked, so undo covers a second pass', async () => {
    document.body.innerHTML = '<input name="zip"><input name="city">'
    const own = createOwnership()
    const first = template([rule('zip', { type: 'zip' })])
    await runFill(document.body, first, ensureSlots(ds, first, fakerDE), 'all', fakerDE, own)
    const second = template([rule('city', { type: 'city' })])
    await runFill(document.body, second, ensureSlots(ds, second, fakerDE), 'all', fakerDE, own, true)
    expect(own.lastRun().map((e) => e.fieldId)).toEqual(['zip', 'city'])
  })
})
