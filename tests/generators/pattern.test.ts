import { describe, expect, it } from 'vitest'
import { fakerDE } from '@faker-js/faker'
import { expandPattern } from '../../src/generators/pattern'

describe('expandPattern', () => {
  it('expands {zahl:N} to N digits', () => {
    expect(expandPattern('TEST-{zahl:6}', 'T1342', fakerDE)).toMatch(/^TEST-\d{6}$/)
  })

  it('expands {buchstabe:N} to N uppercase letters', () => {
    expect(expandPattern('{buchstabe:4}', 'T1342', fakerDE)).toMatch(/^[A-Z]{4}$/)
  })

  it('expands {kennung} to the run id', () => {
    expect(expandPattern('{kennung}-X', 'T1342', fakerDE)).toBe('T1342-X')
  })

  it('expands {datum} to YYYYMMDD', () => {
    expect(expandPattern('{datum}', 'T1342', fakerDE)).toMatch(/^\d{8}$/)
  })

  it('keeps unknown placeholders literally', () => {
    expect(expandPattern('a{foo}b{zahl:x}', 'T1342', fakerDE)).toBe('a{foo}b{zahl:x}')
  })
})
