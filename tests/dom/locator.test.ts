import { beforeEach, describe, expect, it } from 'vitest'
import { describeElement, displayLabel, findElement, isRequired, listControls, normalizeLabel, type FormControl } from '../../src/dom/locator'
import { frame, frameDoc, q as deepQ, shadow } from './deepHelpers'

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
    expect(describeElement(q('[role=radiogroup]'))).toEqual({ kind: 'radiogroup', name: 'ship', label: 'versand' })
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

  it('finds an empty ARIA radiogroup by id but not by a differing aria-label', () => {
    const root = setup('<div role="radiogroup" aria-label="Zahlart" id="rg"></div>')
    expect(findElement(root, { kind: 'radiogroup', ariaLabel: 'zahlart' })).toEqual({ status: 'missing' })
    expect(findElement(root, { kind: 'radiogroup', id: 'rg' })).toEqual({ status: 'found', el: q('#rg') })
  })
})

describe('findElement radio groups', () => {
  it('keeps same-named radio groups of different forms apart', () => {
    const root = setup(`
      <form><input type="radio" name="g" value="1"></form>
      <form><input type="radio" name="g" value="2"></form>
    `)
    expect(findElement(root, { kind: 'radiogroup', name: 'g' })).toEqual({ status: 'ambiguous', count: 2 })
  })

  it('treats an ARIA radiogroup wrapping native radios as one group', () => {
    const root = setup(`
      <span id="g">Versand</span>
      <div role="radiogroup" aria-labelledby="g" id="rg">
        <input type="radio" name="ship" value="a"><input type="radio" name="ship" value="b">
      </div>
    `)
    expect(findElement(root, { kind: 'radiogroup', label: 'versand' })).toEqual({ status: 'found', el: q('#rg') })
    expect(findElement(root, { kind: 'radiogroup', name: 'ship' })).toEqual({ status: 'found', el: q('#rg') })
  })
})

describe('describeElement errors', () => {
  it('throws for unsupported elements', () => {
    setup('<button id="b">x</button><input type="hidden" id="h">')
    expect(() => describeElement(q('#b'))).toThrow()
    expect(() => describeElement(q('#h'))).toThrow()
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

describe('displayLabel', () => {
  it('keeps the original case and strips required markers', () => {
    setup(`
      <label for="a">  Firmen Name *: </label><input id="a" name="company">
      <fieldset><legend>Anrede *</legend><input type="radio" name="s" value="m"></fieldset>
      <input aria-label="USt-IdNr." name="vat">
      <input placeholder="Z. B. Musterstraße" name="street">
      <input name="kostenStelle">
      <input>
    `)
    expect(displayLabel(q('#a'))).toBe('Firmen Name')
    expect(displayLabel(q('[name=s]'))).toBe('Anrede')
    expect(displayLabel(q('[name=vat]'))).toBe('USt-IdNr.')
    expect(displayLabel(q('[name=street]'))).toBe('Z. B. Musterstraße')
    expect(displayLabel(q('[name=kostenStelle]'))).toBe('kostenStelle')
    expect(displayLabel(q('input:not([name])'))).toBe('')
  })
})

describe('listControls', () => {
  it('lists visible supported controls once per radio group, in document order', () => {
    setup(`
      <input name="a"><input type="hidden" name="h"><input type="submit">
      <input type="radio" name="r" value="1"><input type="radio" name="r" value="2">
      <div role="radiogroup" aria-label="G"><input type="radio" name="g"></div>
      <select name="s"></select><textarea name="t"></textarea>
      <div role="combobox" aria-label="C" aria-controls="l"></div>
      <input name="gone" style="display:none">
    `)
    expect(listControls(document.body).map((el) => el.getAttribute('name') ?? el.getAttribute('aria-label'))).toEqual(['a', 'r', 'G', 's', 't', 'C'])
  })
})

describe('deep lookup', () => {
  const zipMarkup = '<label for="zip">PLZ</label><input id="zip" name="zip">'

  it('describes a field inside a shadow root with its label from the same tree and its scope', () => {
    setup('<wc-x id="h"></wc-x>')
    const inner = deepQ<HTMLInputElement>('input', shadow(deepQ('wc-x'), '<label for="i">PLZ</label><input id="i" name="zip">'))
    expect(describeElement(inner)).toEqual({ kind: 'text', name: 'zip', id: 'i', label: 'plz', inputType: 'text', scope: ['wc-x#h'] })
  })

  it('an old locator without scope prefers the main-document field over an equally named one in a frame', async () => {
    setup(zipMarkup)
    await frame(zipMarkup, 'name="delivery"')
    const found = findElement(document, { kind: 'text', name: 'zip', id: 'zip', label: 'plz' })
    expect(found.status).toBe('found')
    if (found.status === 'found') expect(found.el.ownerDocument).toBe(document)
  })

  it('a locator recorded in a frame finds the frame field, not the main-document twin', async () => {
    setup(zipMarkup)
    const f = await frame(zipMarkup, 'name="delivery"')
    const found = findElement(document, { kind: 'text', name: 'zip', id: 'zip', label: 'plz', scope: ['iframe:delivery'] })
    expect(found.status).toBe('found')
    if (found.status === 'found') expect(found.el.ownerDocument).toBe(frameDoc(f))
  })

  it('two identical hosts without id or name stay ambiguous', () => {
    setup('<wc-x></wc-x><wc-x></wc-x>')
    for (const host of Array.from(document.querySelectorAll('wc-x'))) shadow(host, '<input name="zip">')
    expect(findElement(document, { kind: 'text', name: 'zip', scope: ['wc-x'] })).toEqual({ status: 'ambiguous', count: 2 })
  })

  it('treats fields in hidden frames and hidden hosts as invisible', async () => {
    setup('<wc-x style="display:none"></wc-x>')
    shadow(deepQ('wc-x'), '<input name="zip">')
    expect(findElement(document, { kind: 'text', name: 'zip', scope: ['wc-x'] }).status).toBe('missing')
    await frame('<input name="plz">', 'name="hidden" style="display:none"')
    expect(findElement(document, { kind: 'text', name: 'plz', scope: ['iframe:hidden'] }).status).toBe('missing')
  })

  it('listControls includes shadow and frame fields', async () => {
    setup('<input name="a"><wc-x></wc-x>')
    shadow(deepQ('wc-x'), '<select name="b"></select>')
    await frame('<textarea name="c"></textarea>', 'name="delivery"')
    expect(listControls(document).map((el) => el.getAttribute('name'))).toEqual(['a', 'b', 'c'])
  })
})

describe('web component patterns', () => {
  it('falls back to host attributes for name, label, placeholder and required', () => {
    setup('<wc-text-field name="cost_center" label="Kostenstelle" placeholder="z. B. 4711" required></wc-text-field>')
    const inner = deepQ<HTMLInputElement>('input', shadow(deepQ('wc-text-field'), '<input aria-label="Eingabe">'))
    expect(describeElement(inner)).toEqual({
      kind: 'text', name: 'cost_center', label: 'kostenstelle', ariaLabel: 'eingabe', placeholder: 'z. b. 4711', inputType: 'text', scope: ['wc-text-field'],
    })
    expect(isRequired(inner)).toBe(true)
    expect(displayLabel(inner)).toBe('Kostenstelle')
  })

  it('uses a main-document label that points at the host', () => {
    setup('<label for="po-number">Bestellnummer</label><wc-input id="po-number"></wc-input>')
    const inner = deepQ<HTMLInputElement>('input', shadow(deepQ('wc-input'), '<input>'))
    expect(describeElement(inner)).toEqual({ kind: 'text', label: 'bestellnummer', inputType: 'text', scope: ['wc-input#po-number'] })
    expect(displayLabel(inner)).toBe('Bestellnummer')
  })

  it('refinds a host-named field whose inner input has only an aria-label', () => {
    setup('<wc-text-field name="cost_center" label="Kostenstelle"></wc-text-field>')
    const inner = deepQ<HTMLInputElement>('input', shadow(deepQ('wc-text-field'), '<input aria-label="Eingabe">'))
    const found = findElement(document, describeElement(inner))
    expect(found.status).toBe('found')
    if (found.status === 'found') expect(found.el).toBe(inner)
  })

  it('lets the inner field’s own attributes win over the host’s', () => {
    setup('<wc-text-field name="host_name" label="Vom Wirt" placeholder="Wirt"></wc-text-field>')
    const root = shadow(deepQ('wc-text-field'), '<label for="i">Eigenes Label</label><input id="i" name="own" placeholder="Eigen">')
    expect(describeElement(deepQ<HTMLInputElement>('input', root))).toEqual({
      kind: 'text', name: 'own', id: 'i', label: 'eigenes label', placeholder: 'eigen', inputType: 'text', scope: ['wc-text-field'],
    })
  })
})

describe('review fixes – trees, place and overlay', () => {
  const radio = '<label><input type="radio" name="anrede" value="h"> Herr</label><label><input type="radio" name="anrede" value="f"> Frau</label>'

  it('lists a radio group per tree, not once per page', async () => {
    setup(`${radio}<wc-a></wc-a><wc-b></wc-b>`)
    shadow(deepQ('wc-a'), radio)
    shadow(deepQ('wc-b'), radio)
    await frame(radio, 'name="delivery"')
    const where = (el: Element) => (el.ownerDocument !== document ? 'frame' : (el.getRootNode() as Node & { host?: Element }).host?.localName ?? 'main')
    expect(listControls(document).map(where)).toEqual(['main', 'wc-a', 'wc-b', 'frame'])
  })

  it('finds the radio group of the frame a locator was recorded in', async () => {
    setup(radio)
    const f = await frame(radio, 'name="delivery"')
    const found = findElement(document, { kind: 'radiogroup', name: 'anrede', scope: ['iframe:delivery'] })
    expect(found.status).toBe('found')
    if (found.status === 'found') expect(found.el.ownerDocument).toBe(frameDoc(f))
  })

  it('prefers candidates in the locator’s place even when a twin elsewhere matches better', async () => {
    setup('<label for="e">E-Mail-Adresse</label><input id="e" name="email">')
    await frame('<label for="e">E-Mail</label><input id="e" name="email">', 'name="newsletter"')
    const relabelled = findElement(document, { kind: 'text', name: 'email', id: 'e', label: 'e-mail' })
    expect(relabelled.status).toBe('found')
    if (relabelled.status === 'found') expect(relabelled.el.ownerDocument).toBe(document)

    setup('<input name="email">')
    await frame('<label for="e">E-Mail</label><input id="e" name="email">', 'name="newsletter"')
    const weak = findElement(document, { kind: 'text', name: 'email', id: 'e', label: 'e-mail' })
    expect(weak.status).toBe('found')
    if (weak.status === 'found') expect(weak.el.ownerDocument).toBe(document)
  })

  it('falls back to the best match anywhere when nothing sits in the locator’s place', async () => {
    setup('')
    const f = await frame('<label for="e">E-Mail</label><input id="e" name="email">', 'name="newsletter"')
    const found = findElement(document, { kind: 'text', name: 'email', id: 'e', label: 'e-mail', scope: ['iframe:gone'] })
    expect(found.status).toBe('found')
    if (found.status === 'found') expect(found.el.ownerDocument).toBe(frameDoc(f))
  })

  it('ignores the controls of the recorder overlay', () => {
    setup('<input name="a"><form-filler-recorder></form-filler-recorder>')
    shadow(deepQ('form-filler-recorder'), '<select name="type"><option>x</option></select><input name="label">')
    expect(listControls(document).map((el) => el.getAttribute('name'))).toEqual(['a'])
  })
})
