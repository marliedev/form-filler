import { describe, expect, it } from 'vitest'
import { validateConfig } from '../../src/model/validateConfig'

describe('validateConfig', () => {
  it('rejects options without a usable value', () => {
    expect(validateConfig({ type: 'list', values: [] })?.input).toBe('values')
    expect(validateConfig({ type: 'list', values: ['x'] })).toBeNull()
    expect(validateConfig({ type: 'choice', mode: 'random', values: [] })).toBeNull()
    expect(validateConfig({ type: 'choice', mode: 'fixed', values: [] })?.input).toBe('values')
    expect(validateConfig({ type: 'pattern', pattern: ' ' })?.input).toBe('pattern')
    expect(validateConfig({ type: 'number', min: 5, max: 1 })?.input).toBe('min')
    expect(validateConfig({ type: 'number', min: 1, max: Number.NaN })?.input).toBe('max')
    expect(validateConfig({ type: 'birthDate', minAge: -1 })?.input).toBe('minAge')
    expect(validateConfig({ type: 'date', range: 'between', from: '2024-01-01' })?.input).toBe('to')
    expect(validateConfig({ type: 'date', range: 'between', from: '2024-02-01', to: '2024-01-01' })?.input).toBe('from')
    expect(validateConfig({ type: 'date', range: 'past' })).toBeNull()
    expect(validateConfig({ type: 'firstName' })).toBeNull()
  })

  it('treats an empty fixed value as incomplete and points to "Leer lassen"', () => {
    const error = validateConfig({ type: 'fixed', value: ' ' })
    expect(error?.input).toBe('value')
    expect(error?.message).toContain('Leer lassen')
    expect(validateConfig({ type: 'fixed', value: 'x' })).toBeNull()
  })
})
