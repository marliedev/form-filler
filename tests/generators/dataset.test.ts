import { describe, expect, it } from 'vitest'
import { fakerDE } from '@faker-js/faker'
import plz from '../../src/data/plz-de.json'
import { createDataset, ensureSlots } from '../../src/generators/dataset'
import { slotKindFor } from '../../src/generators/catalog'
import { BANKS } from '../../src/generators/banks'
import { LANDLINE_PATTERN, MOBILE_PATTERN } from '../../src/generators/phone'
import type { FieldRule, Template } from '../../src/model/types'

const pairs = new Set((plz as [string, string][]).map(([z, c]) => `${z}|${c}`))

function rule(id: string, type: 'firstName' | 'city' | 'companyName', slot: string | null): FieldRule {
  return {
    id, label: id, locator: { kind: 'text' }, config: { type }, slot, required: false, appendRunId: false,
  }
}

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected value')
  return value
}

function template(fields: FieldRule[]): Template {
  return { id: 't', appId: 'a', name: 't', process: null, fields, lastMissing: [] }
}

describe('createDataset', () => {
  it('creates a run id of the form T####', () => {
    expect(createDataset(fakerDE).runId).toMatch(/^T\d{4}$/)
  })

  it('uses a real zip/city pair', () => {
    for (let i = 0; i < 20; i++) {
      const a = must(createDataset(fakerDE).addresses.A)
      expect(pairs.has(`${a.zip}|${a.city}`)).toBe(true)
      expect(a.country).toBe('Deutschland')
    }
  })

  it('builds the person email from name and company domain', () => {
    for (let i = 0; i < 50; i++) {
      const ds = createDataset(fakerDE)
      const p = must(ds.persons['1'])
      const local = must(p.email.split('@')[0])
      expect(local).toMatch(/^[a-z0-9.-]+$/)
      expect(p.email.endsWith(`@${ds.company.domain}`)).toBe(true)
      expect(p.email).toContain('.')
    }
  })

  it('derives the domain from the company name without legal form', () => {
    const ds = createDataset(fakerDE)
    const base = ds.company.name
      .replace(ds.company.legalForm, '')
      .trim()
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    expect(ds.company.domain).toBe(`${base}.de`)
    expect(ds.company.name.endsWith(ds.company.legalForm)).toBe(true)
  })

  it('transliterates umlauts in email local part', () => {
    fakerDE.seed(1)
    for (let i = 0; i < 100; i++) {
      expect(must(createDataset(fakerDE).persons['1']).email).toMatch(/^[a-z0-9.-]+@[a-z0-9.-]+\.de$/)
    }
  })

  it('does not repeat itself', () => {
    const sets = Array.from({ length: 200 }, () => createDataset(fakerDE))
    expect(new Set(sets.map((d) => d.company.name)).size).toBeGreaterThanOrEqual(190)
    expect(new Set(sets.map((d) => must(d.addresses.A).zip)).size).toBeGreaterThanOrEqual(150)
  })

  it('fills company finance data in plausible formats', () => {
    const c = createDataset(fakerDE).company
    expect(c.iban).toMatch(/^DE\d{20}$/)
    expect(c.vatId).toMatch(/^DE\d{9}$/)
    expect(c.taxNumber).toMatch(/^\d{3}\/\d{4}\/\d{4}$/)
    expect(c.tradeRegister).toMatch(/^HRB \d{4,6}$/)
    expect(c.leitwegId).toMatch(/^\d{8}-\d{10}-\d{2}$/)
  })

  it('pairs the BIC with its bank and keeps both German', () => {
    for (let i = 0; i < 50; i++) {
      const c = createDataset(fakerDE).company
      expect(BANKS).toContainEqual({ name: c.bankName, bic: c.bic })
      expect(c.bic.slice(4, 6)).toBe('DE')
    }
  })

  it('uses drama numbers for every phone number', () => {
    for (let i = 0; i < 50; i++) {
      const ds = createDataset(fakerDE)
      expect(ds.company.phone).toMatch(LANDLINE_PATTERN)
      const p = must(ds.persons['1'])
      expect(p.phone).toMatch(LANDLINE_PATTERN)
      expect(p.mobile).toMatch(MOBILE_PATTERN)
    }
  })

  it('is deterministic for a seeded faker', () => {
    fakerDE.seed(42)
    const a = createDataset(fakerDE)
    fakerDE.seed(42)
    const b = createDataset(fakerDE)
    expect(b.company).toEqual(a.company)
    expect(b.persons).toEqual(a.persons)
  })
})

describe('ensureSlots', () => {
  it('adds missing person and address slots and keeps existing ones', () => {
    const ds = createDataset(fakerDE)
    const before = structuredClone(ds)
    const next = ensureSlots(ds, template([rule('a', 'firstName', '2'), rule('b', 'city', 'B')]), fakerDE)
    expect(next.persons['2']).toBeDefined()
    expect(next.addresses.B).toBeDefined()
    expect(next.persons['1']).toEqual(ds.persons['1'])
    expect(next.addresses.A).toEqual(ds.addresses.A)
    expect(must(next.persons['2']).email.endsWith(`@${ds.company.domain}`)).toBe(true)
    expect(ds).toEqual(before)
  })

  it('maps null slots on person/address types to 1 / A and ignores company types', () => {
    const ds = createDataset(fakerDE)
    const next = ensureSlots(ds, template([rule('a', 'firstName', null), rule('b', 'companyName', 'Z')]), fakerDE)
    expect(next).toEqual(ds)
  })
})

describe('slotKindFor', () => {
  it('classifies types', () => {
    expect(slotKindFor({ type: 'email' })).toBe('person')
    expect(slotKindFor({ type: 'birthDate', minAge: 18 })).toBe('person')
    expect(slotKindFor({ type: 'zip' })).toBe('address')
    expect(slotKindFor({ type: 'iban' })).toBeNull()
    expect(slotKindFor({ type: 'fixed', value: 'x' })).toBeNull()
  })
})
