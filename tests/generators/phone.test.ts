import { fakerDE } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { createLandline, createMobile, LANDLINE_PATTERN, MOBILE_PATTERN } from '../../src/generators/phone'

const RUNS = 300

describe('createLandline', () => {
  it('only produces numbers from the five Bundesnetzagentur drama blocks', () => {
    for (let i = 0; i < RUNS; i++) {
      expect(createLandline(fakerDE)).toMatch(/^0(30 23125|69 90009|40 66969|221 4710|89 99998)\d{3}$/)
    }
  })

  it('uses every block', () => {
    const prefixes = new Set<string>()
    for (let i = 0; i < RUNS; i++) prefixes.add(createLandline(fakerDE).split(' ')[0] ?? '')
    expect([...prefixes].sort()).toEqual(['030', '040', '069', '0221', '089'].sort())
  })
})

describe('createMobile', () => {
  it('only produces numbers from the mobile drama blocks', () => {
    for (let i = 0; i < RUNS; i++) {
      expect(createMobile(fakerDE)).toMatch(/^0(171 39200|176 040690)\d{2}$/)
    }
  })
})

describe('patterns', () => {
  it('match what the generators produce and reject other numbers', () => {
    expect(createLandline(fakerDE)).toMatch(LANDLINE_PATTERN)
    expect(createMobile(fakerDE)).toMatch(MOBILE_PATTERN)
    expect('0221 1234567').not.toMatch(LANDLINE_PATTERN)
    expect('0151 1234567').not.toMatch(MOBILE_PATTERN)
  })
})
