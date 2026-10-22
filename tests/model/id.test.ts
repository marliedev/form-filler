import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from '../../src/model/id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createId', () => {
  it('returns a v4 uuid', () => {
    expect(createId()).toMatch(UUID_V4)
  })

  it('works on insecure http pages where crypto.randomUUID is missing', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    const ids = new Set(Array.from({ length: 50 }, () => createId()))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })
})
