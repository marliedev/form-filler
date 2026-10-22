import { describe, expect, it } from 'vitest'
import { fakerDE } from '@faker-js/faker'
import { DATA_TYPES, slotKindFor } from '../../src/generators/catalog'
import { createDataset, ensureSlots } from '../../src/generators/dataset'
import { applyRunId, resolveValue } from '../../src/generators/resolve'
import type { DataTypeConfig, FieldRule, SimpleTypeId, Template } from '../../src/model/types'

function rule(config: DataTypeConfig, slot: string | null = null, appendRunId = false): FieldRule {
  return { id: 'r', label: 'r', locator: { kind: 'text' }, config, slot, required: false, appendRunId }
}

function dsWith(...fields: FieldRule[]) {
  const t: Template = { id: 't', appId: 'a', name: 't', process: null, fields, lastMissing: [] }
  return ensureSlots(createDataset(fakerDE), t, fakerDE)
}

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('expected value')
  return v
}

describe('resolveValue', () => {
  it('reads zip from the requested address slot', () => {
    const r = rule({ type: 'zip' }, 'B')
    const ds = dsWith(r)
    expect(resolveValue(r, ds, fakerDE)).toEqual({ kind: 'text', value: must(ds.addresses.B).zip })
  })

  it('reads the email of person 2', () => {
    const r = rule({ type: 'email' }, '2')
    const ds = dsWith(r)
    expect(resolveValue(r, ds, fakerDE)).toEqual({ kind: 'text', value: must(ds.persons['2']).email })
  })

  it('defaults slot-less person/address types to 1 / A', () => {
    const ds = dsWith(rule({ type: 'firstName' }), rule({ type: 'city' }))
    expect(resolveValue(rule({ type: 'firstName' }), ds, fakerDE)).toEqual({ kind: 'text', value: must(ds.persons['1']).firstName })
    expect(resolveValue(rule({ type: 'city' }), ds, fakerDE)).toEqual({ kind: 'text', value: must(ds.addresses.A).city })
  })

  it('throws when the slot is missing', () => {
    const ds = createDataset(fakerDE)
    expect(() => resolveValue(rule({ type: 'email' }, '9'), ds, fakerDE)).toThrow(/person slot "9"/)
    expect(() => resolveValue(rule({ type: 'zip' }, 'Z'), ds, fakerDE)).toThrow(/address slot "Z"/)
  })

  it('derives invoice email and website from the company domain', () => {
    const ds = createDataset(fakerDE)
    expect(resolveValue(rule({ type: 'invoiceEmail' }), ds, fakerDE)).toEqual({ kind: 'text', value: `rechnung@${ds.company.domain}` })
    expect(resolveValue(rule({ type: 'website' }), ds, fakerDE)).toEqual({ kind: 'text', value: `https://www.${ds.company.domain}` })
  })

  it('resolves salutation as a fixed choice', () => {
    const ds = createDataset(fakerDE)
    expect(resolveValue(rule({ type: 'salutation' }), ds, fakerDE)).toEqual({
      kind: 'choice', mode: 'fixed', values: [must(ds.persons['1']).salutation],
    })
  })

  it('picks from a list', () => {
    const ds = createDataset(fakerDE)
    const v = resolveValue(rule({ type: 'list', values: ['4711', '4712'] }), ds, fakerDE)
    expect(v.kind).toBe('text')
    expect(['4711', '4712']).toContain(v.kind === 'text' ? v.value : '')
  })

  it('skips on empty and on an empty list', () => {
    const ds = createDataset(fakerDE)
    expect(resolveValue(rule({ type: 'empty' }), ds, fakerDE)).toEqual({ kind: 'skip' })
    expect(resolveValue(rule({ type: 'list', values: [] }), ds, fakerDE)).toEqual({ kind: 'skip' })
  })

  it('resolves checkboxes, including random', () => {
    const ds = createDataset(fakerDE)
    expect(resolveValue(rule({ type: 'checkbox', checked: true }), ds, fakerDE)).toEqual({ kind: 'checkbox', checked: true })
    expect(resolveValue(rule({ type: 'checkbox', checked: 'random' }), ds, fakerDE).kind).toBe('checkbox')
  })

  it('returns a birth date at least minAge years back', () => {
    const ds = createDataset(fakerDE)
    for (const minAge of [18, 40, 70]) {
      const v = resolveValue(rule({ type: 'birthDate', minAge }), ds, fakerDE)
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - minAge)
      expect(v.kind).toBe('date')
      expect(v.kind === 'date' && v.iso <= cutoff.toISOString().slice(0, 10)).toBe(true)
    }
  })

  it('honors date ranges', () => {
    const ds = createDataset(fakerDE)
    const today = new Date().toISOString().slice(0, 10)
    const past = resolveValue(rule({ type: 'date', range: 'past' }), ds, fakerDE)
    const future = resolveValue(rule({ type: 'date', range: 'future' }), ds, fakerDE)
    const between = resolveValue(rule({ type: 'date', range: 'between', from: '2020-01-01', to: '2020-12-31' }), ds, fakerDE)
    expect(past.kind === 'date' && past.iso <= today).toBe(true)
    expect(future.kind === 'date' && future.iso >= today).toBe(true)
    expect(between.kind === 'date' && between.iso >= '2020-01-01' && between.iso <= '2020-12-31').toBe(true)
  })

  it('returns an integer within number bounds', () => {
    const ds = createDataset(fakerDE)
    const v = resolveValue(rule({ type: 'number', min: 5, max: 9 }), ds, fakerDE)
    expect(v.kind === 'text' && /^[5-9]$/.test(v.value)).toBe(true)
  })

  it('expands patterns with the dataset run id', () => {
    const ds = createDataset(fakerDE)
    expect(resolveValue(rule({ type: 'pattern', pattern: '{kennung}-{zahl:3}' }), ds, fakerDE))
      .toEqual({ kind: 'text', value: expect.stringMatching(new RegExp(`^${ds.runId}-\\d{3}$`)) })
  })

  it('appends the run id to text values only', () => {
    const ds = createDataset(fakerDE)
    expect(resolveValue(rule({ type: 'companyName' }, null, true), ds, fakerDE))
      .toEqual({ kind: 'text', value: `${ds.company.name} · ${ds.runId}` })
    expect(resolveValue(rule({ type: 'checkbox', checked: true }, null, true), ds, fakerDE))
      .toEqual({ kind: 'checkbox', checked: true })
  })
})

describe('applyRunId', () => {
  it('appends with separator when there is no limit', () => {
    expect(applyRunId('Brandt Logistik GmbH', 'T1342', null)).toBe('Brandt Logistik GmbH · T1342')
  })

  it('shortens the base value to fit maxLength', () => {
    const v = applyRunId('Brandt Logistik GmbH', 'T1342', 15)
    expect(v.length).toBeLessThanOrEqual(15)
    expect(v.endsWith('· T1342')).toBe(true)
  })

  it('drops the run id when it cannot fit', () => {
    expect(applyRunId('Abc', 'T1342', 5)).toBe('Abc')
  })

  it('never exceeds maxLength when the suffix cannot fit', () => {
    const v = applyRunId('Brandt Logistik GmbH', 'T1342', 5)
    expect(v.length).toBeLessThanOrEqual(5)
    expect(v).not.toContain('T1342')
    expect(applyRunId('Brandt Logistik GmbH', 'T1342', 8).length).toBeLessThanOrEqual(8)
  })
})

describe('DATA_TYPES', () => {
  const simple: SimpleTypeId[] = [
    'companyName', 'legalForm', 'vatId', 'taxNumber', 'tradeRegister', 'industry',
    'salutation', 'firstName', 'lastName', 'jobTitle',
    'streetWithNumber', 'streetName', 'houseNumber', 'zip', 'city', 'country', 'addressLine2',
    'email', 'phone', 'mobile', 'website', 'iban', 'bic', 'bankName', 'invoiceEmail', 'leitwegId', 'text',
  ]
  const extra = ['birthDate', 'date', 'number', 'fixed', 'choice', 'checkbox', 'list', 'pattern', 'empty']

  it('has exactly one entry per data type', () => {
    const types = DATA_TYPES.map((d) => d.type)
    expect(new Set(types).size).toBe(types.length)
    expect([...types].sort()).toEqual([...simple, ...extra].sort())
  })

  it('keeps slot kinds consistent with slotKindFor', () => {
    for (const d of DATA_TYPES) {
      expect(slotKindFor({ type: d.type } as DataTypeConfig)).toBe(d.slotKind)
    }
    expect(DATA_TYPES.filter((d) => d.slotKind === 'person').map((d) => d.type).sort())
      .toEqual(['salutation', 'firstName', 'lastName', 'jobTitle', 'email', 'phone', 'mobile', 'birthDate'].sort())
    expect(DATA_TYPES.filter((d) => d.slotKind === 'address').length).toBe(7)
  })

  it('lists at least one control per type', () => {
    for (const d of DATA_TYPES) expect(d.controls.length).toBeGreaterThan(0)
  })
})
