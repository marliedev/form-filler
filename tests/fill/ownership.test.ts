import { describe, expect, it } from 'vitest'
import { createOwnership, locatorKey, type RunEntry } from '../../src/fill/ownership'

function entry(el: HTMLInputElement, written: string, before = ''): RunEntry {
  return { el, fieldId: 'f', label: 'PLZ', kind: 'text', before, written }
}

describe('ownership', () => {
  it('recognizes own values per element and per locator key after a re-render', () => {
    const o = createOwnership()
    const el = document.createElement('input')
    const key = locatorKey({ kind: 'text', name: 'zip' })
    o.beginRun()
    o.record(entry(el, '50667'), key)
    expect(o.isOwn(el, key, '50667')).toBe(true)
    expect(o.isOwn(el, key, '50668')).toBe(false)
    const rebuilt = document.createElement('input')
    expect(o.isOwn(rebuilt, key, '50667')).toBe(true)
    expect(o.isOwn(rebuilt, locatorKey({ kind: 'text', name: 'city' }), '50667')).toBe(false)
  })

  it('keeps the first shown text of an ARIA control as its placeholder', () => {
    const o = createOwnership()
    const el = document.createElement('div')
    expect(o.placeholderOf(el, 'Bitte wählen')).toBe('Bitte wählen')
    expect(o.placeholderOf(el, 'Deutschland')).toBe('Bitte wählen')
  })

  it('keeps only the last run', () => {
    const o = createOwnership()
    const a = document.createElement('input')
    const b = document.createElement('input')
    o.beginRun()
    o.record(entry(a, '1'), 'ka')
    o.beginRun()
    o.record(entry(b, '2'), 'kb')
    expect(o.lastRun().map((e) => e.el)).toEqual([b])
    o.clearRun()
    expect(o.lastRun()).toEqual([])
    expect(o.isOwn(a, 'ka', '1')).toBe(true)
  })
})
