import { describe, expect, it } from 'vitest'
import { samePage } from '../../src/popup/samePage'

describe('samePage', () => {
  it('ignores query and fragment', () => {
    expect(samePage('https://a.example.com/x?y=1#top', 'https://a.example.com/x')).toBe(true)
  })

  it('distinguishes path, trailing slash and host', () => {
    expect(samePage('https://a.example.com/x', 'https://a.example.com/x/')).toBe(false)
    expect(samePage('https://a.example.com/x', 'https://a.example.com/y')).toBe(false)
    expect(samePage('https://a.example.com/x', 'https://b.example.com/x')).toBe(false)
  })

  it('is false for invalid urls', () => {
    expect(samePage('nope', 'https://a.example.com/x')).toBe(false)
    expect(samePage('', '')).toBe(false)
  })
})
