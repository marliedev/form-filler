import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { Template } from '../../src/model/types'
import { startRecorder } from '../../src/recorder/mountRecorder'
import { saveTemplate } from '../../src/storage/repository'

const t1: Template = { id: 't1', appId: 'app', name: 'Kunde', process: null, fields: [], lastMissing: [] }
const t2: Template = { ...t1, id: 't2', name: 'Lieferant' }

function hosts(): Element[] {
  return Array.from(document.querySelectorAll('form-filler-recorder'))
}

function overlayRoot(): ShadowRoot {
  const root = hosts()[0]?.shadowRoot
  if (!root) throw new Error('overlay not mounted')
  return root
}

function pressEscape(): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

beforeEach(async () => {
  fakeBrowser.reset()
  // Ends a recording left over from the previous test (no unsaved changes there).
  if (hosts().length > 0) {
    pressEscape()
    await flushPromises()
  }
  document.body.innerHTML = '<label for="zip">PLZ</label><input id="zip" name="zip">'
  await saveTemplate(t1)
  await saveTemplate(t2)
})

describe('startRecorder', () => {
  it('answers with a German error for an unknown template', async () => {
    expect(await startRecorder('nope')).toEqual({ ok: false, error: 'Vorlage nicht gefunden' })
    expect(hosts()).toHaveLength(0)
  })

  it('mounts one overlay in a shadow root and does not stack a second one', async () => {
    expect(await startRecorder('t1')).toEqual({ ok: true })
    expect(await startRecorder('t1')).toEqual({ ok: true })
    expect(hosts()).toHaveLength(1)
    expect(overlayRoot().textContent).toContain('Aufnahme · 0 Felder')
    // Page elements stay untouched: no classes or inline styles added.
    expect(document.getElementById('zip')?.getAttribute('class')).toBeNull()
    expect(document.getElementById('zip')?.getAttribute('style')).toBeNull()
  })

  it('refuses another template while the running recording has unsaved changes', async () => {
    await startRecorder('t1')
    document.getElementById('zip')?.focus()
    await flushPromises()
    overlayRoot().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    const answer = await startRecorder('t2')
    expect(answer.ok).toBe(false)
    expect(hosts()).toHaveLength(1)

    // Discard so the next test starts clean.
    pressEscape()
    await flushPromises()
    const discard = Array.from(overlayRoot().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Verwerfen')
    discard?.click()
    await flushPromises()
    expect(hosts()).toHaveLength(0)
  })

  it('replaces a recording without changes when another template starts', async () => {
    await startRecorder('t1')
    expect(await startRecorder('t2')).toEqual({ ok: true })
    expect(hosts()).toHaveLength(1)
  })
})
