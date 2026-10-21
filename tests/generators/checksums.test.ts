import { describe, expect, it } from 'vitest'
import {
  createLeitwegId,
  createVatId,
  isValidIban,
  leitwegCheckDigits,
  vatIdCheckDigit,
} from '../../src/generators/checksums'

/** Deterministic LCG so every run covers the same 100 samples. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('vatIdCheckDigit', () => {
  it.each([
    ['13669597', 6],
    ['81156986', 9],
    ['12927339', 8],
  ])('computes the check digit for %s', (first8, expected) => {
    expect(vatIdCheckDigit(first8)).toBe(expected)
  })
})

describe('createVatId', () => {
  it('creates well-formed ids with a valid check digit', () => {
    const rand = seeded(1)
    for (let i = 0; i < 100; i++) {
      const id = createVatId(rand)
      expect(id).toMatch(/^DE[1-9]\d{8}$/)
      expect(Number(id[10])).toBe(vatIdCheckDigit(id.slice(2, 10)))
    }
  })

  it('is deterministic for a given rand', () => {
    expect(createVatId(seeded(7))).toBe(createVatId(seeded(7)))
  })
})

describe('leitwegCheckDigits', () => {
  it('computes MOD 97-10 check digits', () => {
    expect(leitwegCheckDigits('040110001234512345')).toBe('06')
  })
})

describe('createLeitwegId', () => {
  it('creates well-formed ids with valid check digits', () => {
    const rand = seeded(2)
    for (let i = 0; i < 100; i++) {
      const id = createLeitwegId(rand)
      expect(id).toMatch(/^\d{2,12}(-[A-Z0-9]{1,30})?-\d{2}$/)
      const parts = id.split('-')
      const check = parts.pop()
      expect(leitwegCheckDigits(parts.join(''))).toBe(check)
    }
  })

  it('is deterministic for a given rand', () => {
    expect(createLeitwegId(seeded(3))).toBe(createLeitwegId(seeded(3)))
  })
})

describe('isValidIban', () => {
  it('accepts a valid IBAN', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true)
  })

  it('rejects an IBAN with swapped digits', () => {
    expect(isValidIban('DE89370400440532010300')).toBe(false)
  })
})
