import { describe, expect, it } from 'vitest'
import { matchApp } from '../../src/fill/appMatch'
import type { AppDef } from '../../src/model/types'

const app = (id: string, ...urlPatterns: string[]): AppDef => ({ id, name: id, urlPatterns })

describe('matchApp', () => {
  it('prefers the most specific pattern', () => {
    const apps = [app('wide', 'https://*.example.org/*'), app('narrow', 'https://test.example.org/*')]
    expect(matchApp('https://test.example.org/customers/create', apps)?.id).toBe('narrow')
  })

  it('returns null when nothing matches', () => {
    const apps = [app('wide', 'https://*.example.org/*')]
    expect(matchApp('https://example.com/', apps)).toBeNull()
  })

  it('matches the whole url and treats regex characters literally', () => {
    const apps = [app('a', 'https://a.example.org/?x=1')]
    expect(matchApp('https://a.example.org/?x=1', apps)?.id).toBe('a')
    expect(matchApp('https://a.example.org/?x=12', apps)).toBeNull()
    expect(matchApp('https://aXexample.org/?x=1', apps)).toBeNull()
  })

  it('uses the best pattern of each app', () => {
    const apps = [app('one', '*'), app('two', 'http://localhost:5173/*', '*')]
    expect(matchApp('http://localhost:5173/form', apps)?.id).toBe('two')
  })
})
