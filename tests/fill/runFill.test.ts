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

  it('fills empty fields, HTML defaults and its own values', async () => {
    document.body.innerHTML = '<input name="company" value="Vorbelegt"><input name="first">'
    const t = template([rule('company', { type: 'companyName' }), rule('first', { type: 'firstName' })])
    const own = createOwnership()
    const first = await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE, own)
    expect(first.filled).toBe(2)
    expect(input('company').value).toBe(ds.company.name)
    fakerDE.seed(7)
    const other = createDataset(fakerDE)
    const second = await runFill(document.body, t, ensureSlots(other, t, fakerDE), 'all', fakerDE, own)
    expect(second.filled).toBe(2)
    expect(input('company').value).toBe(other.company.name)
  })

  it('fills a select without placeholder and a checkbox checked by the page, keeps a checkbox ticked by hand', async () => {
    document.body.innerHTML = `
      <select name="industry"><option value="it">IT</option><option value="bau">Bau</option></select>
      <input type="checkbox" name="agb" checked><input type="checkbox" name="news">`
    input('news').checked = true
    const t = template([
      rule('industry', { type: 'choice', mode: 'fixed', values: ['Bau'] }, { locator: { kind: 'select', name: 'industry' } }),
      rule('agb', { type: 'checkbox', checked: false }, { locator: { kind: 'checkbox', name: 'agb' } }),
      rule('news', { type: 'checkbox', checked: false }, { locator: { kind: 'checkbox', name: 'news' } }),
    ])
    const report = await runFill(document.body, t, ds, 'all', fakerDE, createOwnership())
    expect(report.fields.map((f) => f.status)).toEqual(['filled', 'filled', 'kept'])
    expect(document.querySelector<HTMLSelectElement>('select')?.value).toBe('bau')
    expect(input('agb').checked).toBe(false)
    expect(input('news').checked).toBe(true)
  })

  it('records before and written state for undo', async () => {
    document.body.innerHTML = '<input name="company" value="alt">'
    const t = template([rule('company', { type: 'companyName' })])
    const own = createOwnership()
    await runFill(document.body, t, ds, 'all', fakerDE, own)
    expect(own.lastRun()).toMatchObject([{ fieldId: 'company', label: 'Feld company', kind: 'text', before: 'alt', written: ds.company.name }])
  })
})
