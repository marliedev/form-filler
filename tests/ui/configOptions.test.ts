import { describe, expect, it } from 'vitest'
import type { FieldRule } from '../../src/model/types'
import { finalizeConfig, hasOptions, slotOptions } from '../../src/ui/configOptions'

function field(id: string, patch: Partial<FieldRule>): FieldRule {
  return { id, label: id, locator: { kind: 'text' }, config: { type: 'text' }, slot: null, required: false, appendRunId: false, ...patch }
}

describe('slotOptions', () => {
  it('is empty for slotless types', () => {
    expect(slotOptions([], { type: 'iban' }, null, 'x')).toEqual([])
  })

  it('offers used person slots plus the next free one as new, ignoring the field itself', () => {
    const fields = [
      field('a', { config: { type: 'firstName' }, slot: '1' }),
      field('b', { config: { type: 'lastName' }, slot: '2' }),
      field('self', { config: { type: 'email' }, slot: '3' }),
    ]
    expect(slotOptions(fields, { type: 'email' }, '3', 'self')).toEqual([
      { value: '1', label: 'Person 1' },
      { value: '2', label: 'Person 2' },
      { value: '3', label: 'Person 3 (neu)' },
    ])
  })

  it('keeps an unusual current slot and labels address slots', () => {
    expect(slotOptions([], { type: 'city' }, 'C', 'self')).toEqual([
      { value: 'A', label: 'Adresse A' },
      { value: 'C', label: 'Adresse C' },
      { value: 'B', label: 'Adresse B (neu)' },
    ])
  })
})

describe('finalizeConfig', () => {
  it('drops from/to unless the range is between, without touching the input', () => {
    const config = { type: 'date' as const, range: 'past' as const, from: '2020-01-01', to: '2021-01-01' }
    expect(finalizeConfig(config)).toEqual({ type: 'date', range: 'past' })
    expect(config.from).toBe('2020-01-01')
    expect(finalizeConfig({ ...config, range: 'between' })).toEqual({ ...config, range: 'between' })
  })

  it('returns other configs unchanged', () => {
    expect(finalizeConfig({ type: 'list', values: ['a'] })).toEqual({ type: 'list', values: ['a'] })
  })
})

describe('hasOptions', () => {
  it('knows which types have inputs', () => {
    expect(hasOptions('list')).toBe(true)
    expect(hasOptions('companyName')).toBe(false)
  })
})
