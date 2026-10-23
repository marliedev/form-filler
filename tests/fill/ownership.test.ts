import { describe, expect, it } from 'vitest'
import { createOwnership, locatorKey, type RunEntry } from '../../src/fill/ownership'

function entry(el: HTMLInputElement, written: string, before = '', key = 'k'): RunEntry {
  return { el, fieldId: 'f', label: 'PLZ', kind: 'text', key, before, written }
}

describe('ownership', () => {
  it('recognizes own values per element and per locator key after a re-render', () => {
    const o = createOwnership()
    const el = document.createElement('input')
    const key = locatorKey({ kind: 'text', name: 'zip' })
    o.beginRun()
    o.record(entry(el, '50667', '', key))
    expect(o.isOwn(el, key, '50667')).toBe(true)
    expect(o.isOwn(el, key, '50668')).toBe(false)
    const rebuilt = document.createElement('input')
    expect(o.isOwn(rebuilt, key, '50667')).toBe(true)
    expect(o.isOwn(rebuilt, locatorKey({ kind: 'text', name: 'city' }), '50667')).toBe(false)
  })

  it('remembers what a control showed at first contact, per element and per locator key', () => {
    const o = createOwnership()
    const el = document.createElement('div')
    const key = locatorKey({ kind: 'combobox', id: 'country' })
    expect(o.firstSeen(el, key, 'Bitte wählen')).toBe('Bitte wählen')
    expect(o.firstSeen(el, key, 'Deutschland')).toBe('Bitte wählen')
    const rebuilt = document.createElement('div')
    expect(o.firstSeen(rebuilt, key, 'Deutschland')).toBe('Bitte wählen')
    expect(o.firstSeen(rebuilt, locatorKey({ kind: 'combobox', id: 'topic' }), 'Presse')).toBe('Presse')
  })

  it('makes the state before a restored run count as own again', () => {
    const o = createOwnership()
    const el = document.createElement('input')
    o.beginRun()
    const written = entry(el, 'neu', 'alt')
    o.record(written)
    expect(o.isOwn(el, 'k', 'alt')).toBe(false)
    o.restored(written)
    expect(o.isOwn(el, 'k', 'alt')).toBe(true)
    expect(o.isOwn(el, 'k', 'neu')).toBe(false)
    expect(o.isOwn(document.createElement('input'), 'k', 'alt')).toBe(true)
  })

  it('keeps only the last run', () => {
    const o = createOwnership()
    const a = document.createElement('input')
    const b = document.createElement('input')
    o.beginRun()
    o.record(entry(a, '1', '', 'ka'))
    o.beginRun()
    o.record(entry(b, '2', '', 'kb'))
    expect(o.lastRun().map((e) => e.el)).toEqual([b])
    o.clearRun()
    expect(o.lastRun()).toEqual([])
    expect(o.isOwn(a, 'ka', '1')).toBe(true)
  })
})
