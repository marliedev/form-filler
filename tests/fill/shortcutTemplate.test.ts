import { describe, expect, it } from 'vitest'
import { chooseShortcutTemplate } from '../../src/fill/shortcutTemplate'
import type { Template } from '../../src/model/types'

function template(id: string, appId: string, process: Template['process'] = null): Template {
  return { id, appId, name: id, process, fields: [], lastMissing: [] }
}

const step1 = template('s1', 'crm', { name: 'Kundenanlage', step: 1 })
const step2 = template('s2', 'crm', { name: 'Kundenanlage', step: 2 })
const step3 = template('s3', 'crm', { name: 'Kundenanlage', step: 3 })
const solo = template('solo', 'crm')
const other = template('o1', 'crm', { name: 'Bestellung', step: 1 })
const foreign = template('f1', 'shop')

describe('chooseShortcutTemplate', () => {
  it('returns null when the app has no templates', () => {
    expect(chooseShortcutTemplate([], step1)).toBeNull()
  })

  it('takes the only template of the app whatever was used last', () => {
    expect(chooseShortcutTemplate([solo], foreign)).toBe(solo)
    expect(chooseShortcutTemplate([solo], null)).toBe(solo)
  })

  it('repeats the last used template when it has no process', () => {
    expect(chooseShortcutTemplate([step1, solo, step2], solo)).toBe(solo)
  })

  it('continues with the next step of the last used process', () => {
    expect(chooseShortcutTemplate([step2, other, step1, step3], step1)).toBe(step2)
    expect(chooseShortcutTemplate([step2, other, step1, step3], step2)).toBe(step3)
  })

  it('starts the process over after its last step', () => {
    expect(chooseShortcutTemplate([step2, step1, step3], step3)).toBe(step1)
  })

  it('skips a missing step number and continues with the next higher one', () => {
    expect(chooseShortcutTemplate([step1, step3], step1)).toBe(step3)
  })

  it('repeats a single-step process', () => {
    expect(chooseShortcutTemplate([other, solo], other)).toBe(other)
  })

  it('falls back to the first template when the last used one belongs to another app or is unknown', () => {
    expect(chooseShortcutTemplate([step2, step1], foreign)).toBe(step2)
    expect(chooseShortcutTemplate([step2, step1], null)).toBe(step2)
  })
})
