import { beforeEach, describe, expect, it } from 'vitest'
import { describeElement, findElement, isRequired, normalizeLabel, type FormControl } from '../../src/dom/locator'

function setup(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.body
}

function q<T extends FormControl>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`missing ${selector}`)
  return el
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('normalizeLabel', () => {
  it('trims, collapses nbsp, strips trailing * and :, lowercases', () => {
    expect(normalizeLabel('  PLZ * ')).toBe('plz')
    expect(normalizeLabel('Vor   name :')).toBe('vor name')
  })
})

describe('describeElement', () => {
  it('reads label via for=, wrapping label and aria-labelledby', () => {
    setup(`
      <label for="a">Vorname *</label><input id="a" name="first" placeholder="Max">
      <label>Nachname <input name="last"></label>
      <span id="l">Ort</span><input aria-labelledby="l" aria-label="City">
    `)
    expect(describeElement(q('#a'))).toEqual({
      kind: 'text', name: 'first', id: 'a', label: 'vorname', placeholder: 'max', inputType: 'text',
    })
    expect(describeElement(q('[name=last]')).label).toBe('nachname')
    const third = describeElement(q('[aria-labelledby]'))
    expect(third.label).toBe('ort')
    expect(third.ariaLabel).toBe('city')
  })

  it('stores only non-empty attributes', () => {
    setup('<textarea></textarea>')
    expect(describeElement(q('textarea'))).toEqual({ kind: 'textarea' })
  })

  it('maps control kinds', () => {
    setup(`
      <input type="date" id="d"><input type="email" id="e"><select id="s"></select>
      <input type="checkbox" id="c"><div role="combobox" id="cb"></div>
    `)
    expect(describeElement(q('#d')).kind).toBe('date')
    expect(describeElement(q('#e')).kind).toBe('text')
    expect(describeElement(q('#s')).kind).toBe('select')
    expect(describeElement(q('#c')).kind).toBe('checkbox')
    expect(describeElement(q('#cb')).kind).toBe('combobox')
  })

  it('describes a native radio as its group with legend label', () => {
    setup(`
      <fieldset><legend>Anrede</legend>
        <input type="radio" name="sal" value="f"><input type="radio" name="sal" value="m">
      </fieldset>
    `)
    expect(describeElement(q('[value=m]'))).toEqual({ kind: 'radiogroup', name: 'sal', label: 'anrede' })
  })

  it('uses aria-labelledby of an enclosing role=radiogroup', () => {
    setup(`
      <span id="g">Versand</span>
      <div role="radiogroup" aria-labelledby="g"><input type="radio" name="ship" value="a"></div>
    `)
    expect(describeElement(q('[value=a]')).label).toBe('versand')
    expect(describeElement(q('[role=radiogroup]'))).toEqual({ kind: 'radiogroup', label: 'versand' })
  })
})

describe('findElement', () => {
  it('finds by label after DOM reordering', () => {
    const root = setup('<label for="z">PLZ</label><input id="z"><label for="o">Ort</label><input id="o">')
    const loc = describeElement(q('#z'))
    setup('<label for="o2">Ort</label><input id="o2"><label for="z2">PLZ</label><input id="z2">')
    const res = findElement(root, { kind: 'text', label: loc.label })
    expect(res).toEqual({ status: 'found', el: q('#z2') })
  })

  it('disambiguates by name, reports ambiguity for label only', () => {
    const root = setup(`
      <label>Straße <input name="company_street"></label>
      <label>Straße <input name="billing_street"></label>
    `)
    const res = findElement(root, { kind: 'text', name: 'billing_street', label: 'straße' })
    expect(res).toEqual({ status: 'found', el: q('[name=billing_street]') })
    expect(findElement(root, { kind: 'text', label: 'straße' })).toEqual({ status: 'ambiguous', count: 2 })
  })

  it('reports missing for removed field, other kind and weak match', () => {
    const root = setup('<label>PLZ <input name="zip"></label><label>Info <input name="x" placeholder="p"></label>')
    expect(findElement(root, { kind: 'text', name: 'gone' })).toEqual({ status: 'missing' })
    expect(findElement(root, { kind: 'select', label: 'plz' })).toEqual({ status: 'missing' })
    expect(findElement(root, { kind: 'text', placeholder: 'p' })).toEqual({ status: 'missing' })
  })

  it('ignores hidden candidates', () => {
    const root = setup(`
      <input name="a" style="display:none"><div hidden><input name="a"></div>
      <div style="display:none"><input name="a"></div><input name="a" id="vis">
    `)
    expect(findElement(root, { kind: 'text', name: 'a' })).toEqual({ status: 'found', el: q('#vis') })
  })

  it('finds a radio group by name and returns the first visible radio', () => {
    const root = setup(`
      <input type="radio" name="g" value="1" hidden>
      <input type="radio" name="g" value="2" id="second"><input type="radio" name="g" value="3">
      <input type="radio" name="h" value="1">
    `)
    expect(findElement(root, { kind: 'radiogroup', name: 'g' })).toEqual({ status: 'found', el: q('#second') })
  })

  it('finds an ARIA radiogroup element', () => {
    const root = setup('<div role="radiogroup" aria-label="Zahlart" id="rg"></div>')
    expect(findElement(root, { kind: 'radiogroup', ariaLabel: 'zahlart' })).toEqual({ status: 'missing' })
    expect(findElement(root, { kind: 'radiogroup', id: 'rg' })).toEqual({ status: 'found', el: q('#rg') })
  })
})

describe('isRequired', () => {
  it('detects required, aria-required and starred label', () => {
    setup(`
      <input id="a" required><div role="combobox" aria-required="true" id="b"></div>
      <label for="c">Ort *</label><input id="c"><input id="d">
    `)
    expect(isRequired(q('#a'))).toBe(true)
    expect(isRequired(q('#b'))).toBe(true)
    expect(isRequired(q('#c'))).toBe(true)
    expect(isRequired(q('#d'))).toBe(false)
  })
})
