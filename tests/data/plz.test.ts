import { describe, expect, it } from 'vitest'
import plz from '../../src/data/plz-de.json'

describe('plz-de.json', () => {
  it('has more than 5000 entries', () => {
    expect(plz.length).toBeGreaterThan(5000)
  })

  it('has 5-digit zip codes only', () => {
    for (const [zip] of plz) expect(zip).toMatch(/^\d{5}$/)
  })

  it('contains Mönchengladbach', () => {
    expect(plz).toContainEqual(['41061', 'Mönchengladbach'])
  })

  it('has no duplicate pairs', () => {
    expect(new Set(plz.map(([z, c]) => `${z}|${c}`)).size).toBe(plz.length)
  })
})
