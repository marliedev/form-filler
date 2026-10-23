import { beforeEach, describe, expect, it } from 'vitest'
import { assignSlots, scanControls } from '../../src/dom/scan'
import type { DataTypeConfig, FieldRule } from '../../src/model/types'

function setup(html: string): void {
  document.body.innerHTML = html
}

function rule(type: DataTypeConfig['type']): FieldRule {
  return {
    id: type,
    label: type,
    locator: { kind: 'text', name: type },
    config: { type } as DataTypeConfig,
    slot: null,
    required: false,
    appendRunId: false,
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('assignSlots', () => {
  it('opens the next address or person slot when a type repeats within the current slot', () => {
    const rules = ['companyName', 'streetName', 'zip', 'city', 'streetName', 'zip', 'firstName', 'lastName', 'email', 'firstName'].map((t) =>
      rule(t as DataTypeConfig['type']),
    )
    expect(assignSlots(rules).map((r) => r.slot)).toEqual([null, 'A', 'A', 'A', 'B', 'B', '1', '1', '1', '2'])
  })

  it('keeps a directly repeated type in the same slot (confirmation fields)', () => {
    const rules = ['firstName', 'lastName', 'email', 'email', 'phone'].map((t) => rule(t as DataTypeConfig['type']))
    expect(assignSlots(rules).map((r) => r.slot)).toEqual(['1', '1', '1', '1', '1'])
  })

  it('does not mutate its input', () => {
    const rules = [rule('zip'), rule('zip')]
    assignSlots(rules)
    expect(rules.map((r) => r.slot)).toEqual([null, null])
  })
})

describe('scanControls', () => {
  it('builds recorder-like rules for the form fields and skips page chrome, search, disabled and readonly fields', () => {
    setup(`
      <header><input name="q"></header>
      <nav><select name="lang"><option>de</option></select></nav>
      <div role="search"><input name="s"></div>
      <main>
        <label for="c">Firmenname *</label><input id="c" name="company" required>
        <label for="p">PLZ</label><input id="p" name="zip">
        <input name="off" disabled><input name="ro" readonly><input type="search" name="find">
        <label for="pw">Passwort</label><input id="pw" type="password">
      </main>
      <footer><input name="newsletter"></footer>
    `)
    const rules = scanControls(document.body)
    expect(rules.map((r) => [r.label, r.config.type, r.slot, r.required, r.appendRunId])).toEqual([
      ['Firmenname', 'companyName', null, true, false],
      ['PLZ', 'zip', 'A', false, false],
      ['Passwort', 'fixed', null, false, false],
    ])
    expect(rules.map((r) => r.locator)).toEqual([
      { kind: 'text', name: 'company', id: 'c', label: 'firmenname', inputType: 'text' },
      { kind: 'text', name: 'zip', id: 'p', label: 'plz', inputType: 'text' },
      { kind: 'text', id: 'pw', label: 'passwort', inputType: 'password' },
    ])
    expect(new Set(rules.map((r) => r.id)).size).toBe(3)
  })

  it('falls back to a random option for choice controls whose suggestion yields free text, and to text for empty lists', () => {
    setup(`
      <label for="b">Branche</label><select id="b" name="industry"><option value="it">IT</option></select>
      <label for="a">Anrede</label><select id="a" name="salutation"><option>Herr</option></select>
      <fieldset><legend>Position</legend><label><input type="radio" name="role" value="x"> X</label></fieldset>
      <label for="k">Kostenstelle</label><input id="k" name="cost_center">
      <label for="l">Land</label><div id="l" role="combobox" aria-controls="list"></div>
    `)
    expect(scanControls(document.body).map((r) => r.config)).toEqual([
      { type: 'choice', mode: 'random', values: [] },
      { type: 'salutation' },
      { type: 'choice', mode: 'random', values: [] },
      { type: 'text' },
      { type: 'country' },
    ])
  })

  it('names unlabeled fields by their name attribute, else "Feld"', () => {
    setup('<input name="customer_no"><input>')
    expect(scanControls(document.body).map((r) => r.label)).toEqual(['customer_no', 'Feld'])
  })

  it('excludes fields of components that sit in page chrome', () => {
    setup('<header><x-host></x-host></header><input name="y">')
    const host = document.querySelector('x-host')
    if (!host) throw new Error('missing host')
    host.attachShadow({ mode: 'open' }).innerHTML = '<input name="x">'
    expect(scanControls(document.body).map((r) => r.locator.name)).toEqual(['y'])
  })

  it('ignores the recorder overlay host', () => {
    setup('<form-filler-recorder><input name="x"></form-filler-recorder><input name="y">')
    expect(scanControls(document.body).map((r) => r.locator.name)).toEqual(['y'])
  })
})
