import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { Template } from '../../src/model/types'
import Recorder from '../../src/recorder/Recorder.vue'
import { useRecorder } from '../../src/recorder/useRecorder'
import { getTemplate, saveTemplate } from '../../src/storage/repository'

const template: Template = { id: 't1', appId: 'app', name: 'Kunde', process: null, fields: [], lastMissing: [] }

let wrapper: VueWrapper | null = null

function page<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`missing ${selector}`)
  return el
}

async function mountOverlay(t: Template = template) {
  const host = document.createElement('div')
  document.body.append(host)
  const recorder = useRecorder(t)
  wrapper = mount(Recorder, { props: { recorder, host }, attachTo: host })
  await flushPromises()
  return { w: wrapper, recorder, host }
}

function key(target: EventTarget, k: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }))
}

beforeEach(async () => {
  fakeBrowser.reset()
  document.body.innerHTML = `
    <label for="company">Firmenname *</label><input id="company" name="company">
    <label for="zip">PLZ</label><input id="zip" name="zip">
    <button id="page-button">Weiter</button>`
  await saveTemplate(template)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('Recorder overlay', () => {
  it('opens the popover with the suggested type when a page field gets focus', async () => {
    const { w } = await mountOverlay()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    page('#company').focus()
    await flushPromises()
    const dialog = w.get('[role="dialog"]')
    expect(dialog.text()).toContain('Feld „Firmenname“')
    expect(w.get<HTMLSelectElement>('#ff-type').element.value).toBe('companyName')
    expect(w.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true)
    expect(document.activeElement).toBe(w.get('#ff-type').element)
  })

  it('keeps Tab and Shift+Tab inside the open popover', async () => {
    const { w } = await mountOverlay()
    page('#company').focus()
    await flushPromises()
    const typeSelect = w.get('#ff-type').element as HTMLElement
    const acceptButton = w.findAll('button').find((b) => b.text() === 'Übernehmen')?.element
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    typeSelect.dispatchEvent(shiftTab)
    expect(shiftTab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(acceptButton)
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    acceptButton?.dispatchEvent(tab)
    expect(document.activeElement).toBe(typeSelect)
  })

  it('does not replace an open draft when another page field gets focus', async () => {
    const { w } = await mountOverlay()
    page('#company').focus()
    await flushPromises()
    await w.get('#ff-type').setValue('fixed')
    page('#zip').focus()
    await flushPromises()
    expect(w.get('[role="dialog"]').text()).toContain('Feld „Firmenname“')
    expect(w.get<HTMLSelectElement>('#ff-type').element.value).toBe('fixed')
    expect(w.get('[role="status"]').text()).toContain('zuerst übernehmen oder abbrechen')
  })

  it('shows a save error and the discard question without overlap', async () => {
    const { w, recorder } = await mountOverlay()
    page('#zip').focus()
    await flushPromises()
    await w.get('form').trigger('submit')
    recorder.save = () => Promise.reject(new Error('quota'))
    await w.findAll('button').find((b) => b.text() === 'Speichern')?.trigger('click')
    await flushPromises()
    key(document.body, 'Escape')
    await flushPromises()
    const alert = w.get('[role="alert"]')
    const confirm = w.get('[role="alertdialog"]')
    expect(alert.text()).toContain('Speichern fehlgeschlagen: quota')
    expect(alert.element.parentElement).toBe(confirm.element.parentElement)
  })

  it('ignores focus on unsupported page elements', async () => {
    const { w } = await mountOverlay()
    page('#page-button').focus()
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('accepting adds the field, returns focus to it without reopening the popover', async () => {
    const { w, recorder } = await mountOverlay()
    page('#company').focus()
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(recorder.fields.value).toHaveLength(1)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(page('#company'))
    expect(w.text()).toContain('Aufnahme · 1 Feld')
    expect(w.get('[role="status"]').text()).toContain('übernommen')
  })

  it('first Esc closes the popover and focuses the bar, second Esc asks before discarding', async () => {
    const { w, recorder } = await mountOverlay()
    page('#company').focus()
    await flushPromises()
    await w.get('form').trigger('submit')
    page('#zip').focus()
    await flushPromises()

    key(w.get('#ff-type').element, 'Escape')
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    const save = w.findAll('button').find((b) => b.text() === 'Speichern')
    expect(document.activeElement).toBe(save?.element)

    key(document.activeElement ?? document.body, 'Escape')
    await flushPromises()
    const confirm = w.get('[role="alertdialog"]')
    expect(confirm.text()).toContain('Ungespeicherte Änderungen verwerfen?')
    expect(w.emitted('close')).toBeUndefined()

    await confirm.findAll('button').find((b) => b.text() === 'Verwerfen')?.trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    expect(recorder.fields.value).toEqual([])
    expect((await getTemplate('t1'))?.fields).toEqual([])
  })

  it('Esc from the page without changes ends right away', async () => {
    const { w } = await mountOverlay()
    key(document.body, 'Escape')
    await flushPromises()
    expect(w.find('[role="alertdialog"]').exists()).toBe(false)
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('Speichern writes the template and announces it', async () => {
    const { w } = await mountOverlay()
    page('#zip').focus()
    await flushPromises()
    await w.get('form').trigger('submit')
    await w.findAll('button').find((b) => b.text() === 'Speichern')?.trigger('click')
    await flushPromises()
    expect((await getTemplate('t1'))?.fields.map((f) => f.config.type)).toEqual(['zip'])
    expect(w.get('[role="status"]').text()).toBe('Vorlage gespeichert')
  })

  it('validates type options before accepting', async () => {
    const { w, recorder } = await mountOverlay()
    page('#company').focus()
    await flushPromises()
    await w.get('#ff-type').setValue('list')
    await w.get('form').trigger('submit')
    expect(w.get('[role="alert"]').text()).toContain('mindestens einen Wert')
    expect(recorder.fields.value).toEqual([])
    await w.get('#ff-list').setValue('A\nB')
    await w.get('form').trigger('submit')
    expect(recorder.fields.value[0]?.config).toEqual({ type: 'list', values: ['A', 'B'] })
  })
})
