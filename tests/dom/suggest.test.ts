import { describe, expect, it } from 'vitest'
import { suggestDataType } from '../../src/dom/suggest'
import type { FormControl } from '../../src/dom/locator'
import { q as deepQ, shadow } from './deepHelpers'

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

  it('prefers the label over name and orders specific rules before company', () => {
    expect(suggestDataType(el('<label>Straße <input name="company_street"></label>'))).toEqual({ type: 'streetName' })
    expect(suggestDataType(el('<input name="company_street">'))).toEqual({ type: 'streetName' })
  })

  it('suggests jobTitle, not salutation, for title-like fields', () => {
    expect(suggestDataType(el('<label>Job title <input></label>'))).toEqual({ type: 'jobTitle' })
    expect(suggestDataType(el('<input autocomplete="organization-title">'))).toEqual({ type: 'jobTitle' })
  })

  it('gives password fields a fixed value so repeated passwords match', () => {
    expect(suggestDataType(el('<label>Passwort <input type="password"></label>'))).toEqual({ type: 'fixed', value: 'Test1234!' })
  })

  it('suggests from the host name, label and autocomplete of a web component', () => {
    document.body.innerHTML = '<wc-a name="iban"></wc-a><wc-b label="Nachname"></wc-b><wc-c autocomplete="email"></wc-c>'
    expect(suggestDataType(deepQ<FormControl>('input', shadow(deepQ('wc-a'), '<input>')))).toEqual({ type: 'iban' })
    expect(suggestDataType(deepQ<FormControl>('input', shadow(deepQ('wc-b'), '<input>')))).toEqual({ type: 'lastName' })
    expect(suggestDataType(deepQ<FormControl>('input', shadow(deepQ('wc-c'), '<input>')))).toEqual({ type: 'email' })
  })

  it('throws for unsupported elements', () => {
    expect(() => {
      document.body.innerHTML = '<button>x</button>'
      return suggestDataType(document.body.querySelector('button') as HTMLElement)
    }).toThrow('Unsupported')
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
