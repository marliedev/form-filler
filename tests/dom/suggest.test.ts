import { describe, expect, it } from 'vitest'
import { suggestDataType } from '../../src/dom/suggest'
import type { FormControl } from '../../src/dom/locator'

function el(html: string): FormControl {
  document.body.innerHTML = html
  return document.body.querySelector('input, select, textarea, [role]') as FormControl
}

describe('suggestDataType', () => {
  it('matches by label', () => {
    expect(suggestDataType(el('<label>PLZ <input></label>'))).toEqual({ type: 'zip' })
    expect(suggestDataType(el('<label>IBAN <input></label>'))).toEqual({ type: 'iban' })
    expect(suggestDataType(el('<label>USt-IdNr. <input></label>'))).toEqual({ type: 'vatId' })
    expect(suggestDataType(el('<label>Leitweg-ID <input></label>'))).toEqual({ type: 'leitwegId' })
    expect(suggestDataType(el('<label>Straße + Hausnummer <input></label>'))).toEqual({ type: 'streetWithNumber' })
    expect(suggestDataType(el('<label>Straße <input></label>'))).toEqual({ type: 'streetName' })
  })

  it('matches by autocomplete and english names', () => {
    expect(suggestDataType(el('<input autocomplete="email">'))).toEqual({ type: 'email' })
    expect(suggestDataType(el('<input name="billing_zip">'))).toEqual({ type: 'zip' })
    expect(suggestDataType(el('<input name="postalCode">'))).toEqual({ type: 'zip' })
  })

  it('does not mistake an e-mail address for a street', () => {
    expect(suggestDataType(el('<label>E-Mail-Adresse <input></label>'))).toEqual({ type: 'email' })
  })

  it('suggests list and pattern types', () => {
    expect(suggestDataType(el('<label>Kostenstelle <input></label>'))).toEqual({ type: 'list', values: [] })
    expect(suggestDataType(el('<label>Kundennummer <input></label>'))).toEqual({ type: 'pattern', pattern: 'TEST-{zahl:6}' })
  })

  it('falls back by control kind', () => {
    expect(suggestDataType(el('<select><option>a</option></select>'))).toEqual({ type: 'choice', mode: 'random', values: [] })
    expect(suggestDataType(el('<input type="date">'))).toEqual({ type: 'date', range: 'past' })
    expect(suggestDataType(el('<input type="checkbox">'))).toEqual({ type: 'checkbox', checked: true })
    expect(suggestDataType(el('<input name="foo">'))).toEqual({ type: 'text' })
  })

  it('uses a birth date type for date inputs labelled Geburtsdatum', () => {
    expect(suggestDataType(el('<label>Geburtsdatum <input type="date"></label>'))).toEqual({ type: 'birthDate', minAge: 18 })
  })

  it('returns fresh objects', () => {
    const a = suggestDataType(el('<label>Kostenstelle <input></label>'))
    if (a.type === 'list') a.values.push('x')
    expect(suggestDataType(el('<label>Kostenstelle <input></label>'))).toEqual({ type: 'list', values: [] })
  })
})
