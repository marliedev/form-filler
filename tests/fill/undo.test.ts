import { fakerDE } from '@faker-js/faker'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDataset, ensureSlots, type Dataset } from '../../src/generators/dataset'
import { createOwnership } from '../../src/fill/ownership'
import { runFill } from '../../src/fill/runFill'
import { undoLastRun } from '../../src/fill/undo'
import type { DataTypeConfig, FieldLocator, FieldRule, Template } from '../../src/model/types'

function rule(id: string, config: DataTypeConfig, locator: FieldLocator = { kind: 'text', name: id }): FieldRule {
  return { id, label: `Feld ${id}`, locator, config, slot: null, required: true, appendRunId: false }
}

function template(fields: FieldRule[]): Template {
  return { id: 't1', appId: 'app', name: 'Vorlage', process: null, fields, lastMissing: [] }
}

function q<T extends HTMLElement = HTMLInputElement>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`missing ${selector}`)
  return el
}

let ds: Dataset

beforeEach(() => {
  fakerDE.seed(42)
  document.body.innerHTML = ''
  ds = createDataset(fakerDE)
})

describe('undoLastRun', () => {
  it('restores text, select and checkbox to their state before the run', async () => {
    document.body.innerHTML = `
      <input name="company">
      <select name="industry"><option value="">Bitte wählen</option><option value="bau">Bau</option></select>
      <input type="checkbox" name="agb">`
    const t = template([
      rule('company', { type: 'companyName' }),
      rule('industry', { type: 'choice', mode: 'fixed', values: ['Bau'] }, { kind: 'select', name: 'industry' }),
      rule('agb', { type: 'checkbox', checked: true }, { kind: 'checkbox', name: 'agb' }),
    ])
    const own = createOwnership()
    await runFill(document.body, t, ds, 'all', fakerDE, own)
    expect(q('[name="company"]').value).toBe(ds.company.name)

    expect(await undoLastRun(own)).toEqual({ ok: true, restored: 3, kept: [] })
    expect(q('[name="company"]').value).toBe('')
    expect(q<HTMLSelectElement>('select').value).toBe('')
    expect(q('[name="agb"]').checked).toBe(false)
    expect(own.lastRun()).toEqual([])
  })

  it('leaves fields changed by hand after the run and names them', async () => {
    document.body.innerHTML = '<input name="zip"><input name="city">'
    const t = template([rule('zip', { type: 'zip' }), rule('city', { type: 'city' })])
    const own = createOwnership()
    await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE, own)
    q('[name="zip"]').value = 'manuell'

    expect(await undoLastRun(own)).toEqual({ ok: true, restored: 1, kept: ['Feld zip'] })
    expect(q('[name="zip"]').value).toBe('manuell')
    expect(q('[name="city"]').value).toBe('')
  })

  it('cannot clear a radio group or a combobox that showed its placeholder and says so', async () => {
    document.body.innerHTML = `
      <label><input type="radio" name="role" value="a"> A</label><label><input type="radio" name="role" value="b"> B</label>
      <div role="combobox" id="cb" tabindex="0" aria-controls="lb"><span id="shown">Bitte wählen</span></div>
      <ul role="listbox" id="lb" hidden><li role="option">Deutschland</li></ul>`
    const cb = q<HTMLElement>('#cb')
    const lb = q<HTMLElement>('#lb')
    cb.addEventListener('click', () => { lb.hidden = false })
    q<HTMLElement>('li').addEventListener('mousedown', () => {
      q<HTMLElement>('#shown').textContent = 'Deutschland'
      lb.hidden = true
    })
    const t = template([
      rule('role', { type: 'choice', mode: 'fixed', values: ['B'] }, { kind: 'radiogroup', name: 'role' }),
      rule('country', { type: 'country' }, { kind: 'combobox', id: 'cb' }),
    ])
    const own = createOwnership()
    const report = await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE, own)
    expect(report.filled).toBe(2)

    expect(await undoLastRun(own)).toEqual({ ok: true, restored: 0, kept: ['Feld role', 'Feld country'] })
    expect(q('[name="role"][value="b"]').checked).toBe(true)
    expect(q<HTMLElement>('#shown').textContent).toBe('Deutschland')
  })

  it('makes restored values own again so the next run replaces them', async () => {
    document.body.innerHTML = '<input name="company">'
    const t = template([rule('company', { type: 'companyName' })])
    const own = createOwnership()
    await runFill(document.body, t, ds, 'all', fakerDE, own)
    fakerDE.seed(7)
    const second = createDataset(fakerDE)
    await runFill(document.body, t, second, 'all', fakerDE, own)
    expect(await undoLastRun(own)).toEqual({ ok: true, restored: 1, kept: [] })
    expect(q('[name="company"]').value).toBe(ds.company.name)

    fakerDE.seed(9)
    const third = createDataset(fakerDE)
    const report = await runFill(document.body, t, third, 'all', fakerDE, own)
    expect(report.fields[0]?.status).toBe('filled')
    expect(q('[name="company"]').value).toBe(third.company.name)
  })

  it('restores in reverse order and names fields that left the page, in form order', async () => {
    document.body.innerHTML = '<input name="zip"><input name="city"><input name="first">'
    const t = template([rule('zip', { type: 'zip' }), rule('city', { type: 'city' }), rule('first', { type: 'firstName' })])
    const own = createOwnership()
    await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE, own)
    const order: string[] = []
    for (const el of document.querySelectorAll('input')) el.addEventListener('input', () => order.push(el.name))
    q('[name="zip"]').remove()
    q('[name="first"]').remove()

    expect(await undoLastRun(own)).toEqual({ ok: true, restored: 1, kept: ['Feld zip', 'Feld first'] })
    expect(order).toEqual(['city'])
  })

  it('restores every field of a run in reverse order', async () => {
    document.body.innerHTML = '<input name="zip"><input name="city">'
    const t = template([rule('zip', { type: 'zip' }), rule('city', { type: 'city' })])
    const own = createOwnership()
    await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE, own)
    const order: string[] = []
    for (const el of document.querySelectorAll('input')) el.addEventListener('input', () => order.push(el.name))
    expect(await undoLastRun(own)).toEqual({ ok: true, restored: 2, kept: [] })
    expect(order).toEqual(['city', 'zip'])
  })

  it('answers with an error when there is nothing to undo', async () => {
    expect(await undoLastRun(createOwnership())).toEqual({
      ok: false,
      error: 'Nichts zum Zurücknehmen – die Seite wurde seit dem letzten Lauf neu geladen.',
    })
  })
})
