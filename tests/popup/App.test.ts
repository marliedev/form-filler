import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import App from '../../entrypoints/popup/App.vue'
import { recordFillResult } from '../../src/fill/lastReport'
import type { ContentMessage } from '../../src/fill/messages'
import type { FillReport } from '../../src/fill/runFill'
import type { FieldRule } from '../../src/model/types'
import { saveApp, saveTemplate } from '../../src/storage/repository'
import { fakerDE } from '@faker-js/faker'
import { createDataset } from '../../src/generators/dataset'

const report: FillReport = {
  templateId: 't1',
  filled: 1,
  total: 2,
  fields: [
    { fieldId: 'a', label: 'Firmenname', status: 'filled' },
    { fieldId: 'b', label: 'Rechtsform', status: 'missing' },
  ],
}

function mockActiveTab(url: string, id = 7, title = 'Seite') {
  const query = vi.fn<(info: unknown) => Promise<{ id: number; url: string; title: string }[]>>(async () => [{ id, url, title }])
  vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(query as unknown as typeof fakeBrowser.tabs.query)
}

// The browser APIs are overloaded (promise + callback), so the mocks are typed separately and cast once.
function mockPermission(api: 'request' | 'contains', granted: boolean) {
  const fn = vi.fn<(p: unknown) => Promise<boolean>>(async () => granted)
  vi.spyOn(fakeBrowser.permissions, api).mockImplementation(fn as unknown as typeof fakeBrowser.permissions.request)
  return fn
}

/** runFill reports the id of the template it ran with, so a quick fill answers with 'quick'. */
const quickReport: FillReport = { ...report, templateId: 'quick' }

/** Answers `scan` with the given fields and every other message with `response`. */
function mockScanAndFill(fields: FieldRule[], response: unknown = quickReport) {
  const execute = vi.fn<(injection: unknown) => Promise<unknown[]>>(async () => [])
  const send = vi.fn<(tabId: number, message: ContentMessage) => Promise<unknown>>(async (_tab, message) =>
    message.type === 'scan' ? { ok: true, fields } : response,
  )
  vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(execute as unknown as typeof fakeBrowser.scripting.executeScript)
  vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation(send as unknown as typeof fakeBrowser.tabs.sendMessage)
  return { execute, send }
}

const scanned: FieldRule = {
  id: 'a', label: 'A', locator: { kind: 'text', name: 'a' }, config: { type: 'companyName' }, slot: null, required: false, appendRunId: false,
}

function buttonByText(w: ReturnType<typeof mount>, text: string) {
  return w.findAll('button').find((b) => b.text() === text)
}

async function mountApp() {
  const w = mount(App, { attachTo: document.body })
  await flushPromises()
  return w
}

beforeEach(async () => {
  fakeBrowser.reset()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({ version: '0.1.0' } as ReturnType<typeof fakeBrowser.runtime.getManifest>)
  await saveApp({ id: 'crm', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] })
  await saveTemplate({ id: 't1', appId: 'crm', name: 'Kunde', process: { name: 'Kundenanlage', step: 1 }, fields: [], lastMissing: [] })
})

describe('popup App', () => {
  it('shows the version of the installed build', async () => {
    await mountApp()
    expect(document.body.textContent).toContain('Form Filler 0.1.0')
  })

  it('shows the detected app, its templates and the last report in the live status line', async () => {
    await recordFillResult(7, report)
    mockActiveTab('https://crm.example.com/x')
    const w = await mountApp()
    expect(w.get('h1').text()).toBe('CRM, An der Adresse erkannt')
    expect(w.text()).toContain('Kundenanlage · Schritt 1')
    const status = w.get('[role="status"]')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toBe('Kunde: 1 von 2 befüllt · 1 nicht gefunden')
    expect(w.get('button[aria-label="Füllen: Kunde"]').text()).toBe('Füllen')
    w.unmount()
  })

  it('shows the active dataset with a reset button, or a hint before the first fill', async () => {
    mockActiveTab('https://crm.example.com/x')
    const before = await mountApp()
    expect(before.get('[data-testid="dataset"]').text()).toContain('Noch kein Datensatz')
    expect(before.findAll('button').some((b) => b.text() === 'Neuer Datensatz')).toBe(false)
    before.unmount()

    await fakeBrowser.storage.session.set({ 'ds:7:Kundenanlage': { ...createDataset(fakerDE), runId: 'T4821' } })
    const w = await mountApp()
    expect(w.get('[data-testid="dataset"]').text()).toContain('T4821 · ')
    const reset = w.findAll('button').find((b) => b.text() === 'Neuer Datensatz')
    expect(reset).toBeDefined()
    await reset?.trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="dataset"]').text()).toContain('Noch kein Datensatz')
    w.unmount()
  })

  it('expands the status line into the field report', async () => {
    await recordFillResult(7, report)
    mockActiveTab('https://crm.example.com/x')
    const w = await mountApp()
    const toggle = w.get('button[aria-controls="fill-report"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(w.get('#fill-report').text()).toContain('Rechtsform')
    w.unmount()
  })

  it('opens the template menu as a disclosure and closes it with Escape', async () => {
    mockActiveTab('https://crm.example.com/x')
    const w = await mountApp()
    const more = w.get('button[aria-label="Weitere Aktionen: Kunde"]')
    expect(more.attributes('aria-expanded')).toBe('false')
    await more.trigger('click')
    expect(more.attributes('aria-expanded')).toBe('true')
    const menu = w.get('#menu-t1')
    expect(menu.findAll('button').map((b) => b.text())).toEqual(['Felder aufnehmen', 'Bearbeiten'])
    await menu.findAll('button')[0]?.trigger('keydown', { key: 'Escape' })
    expect(w.find('#menu-t1').exists()).toBe(false)
    expect(document.activeElement).toBe(more.element)
    w.unmount()
  })

  it('offers a new app with the origin pattern when nothing is detected', async () => {
    mockActiveTab('https://neu.example.org/start')
    const w = await mountApp()
    expect(w.text()).toContain('Neue App für diese Seite')
    expect((w.get('#new-app-pattern').element as HTMLInputElement).value).toBe('https://neu.example.org/*')
    expect(w.get('label[for="new-app-name"]').text()).toBe('Name')
    w.unmount()
  })

  it('shows an alert when loading fails', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockRejectedValue(new Error('boom'))
    const w = await mountApp()
    expect(w.get('[role="alert"]').text()).toContain('Popup konnte nicht geladen werden.')
    w.unmount()
  })

  it('switches the app only after confirming and then focuses the heading', async () => {
    await saveApp({ id: 'shop', name: 'Shop', urlPatterns: ['https://shop.example.com/*'] })
    mockActiveTab('https://crm.example.com/x')
    const w = await mountApp()
    await w.get('button[aria-controls="app-picker"]').trigger('click')
    await w.get('#app-picker-select').setValue('shop')
    expect(w.get('h1').text()).toContain('CRM')
    await w.get('#app-picker').trigger('submit')
    await flushPromises()
    expect(w.get('h1').text()).toBe('Shop, Manuell gewählt')
    expect(document.activeElement).toBe(w.get('h1').element)
    w.unmount()
  })

  it('closes the template menu with Escape on its toggle', async () => {
    mockActiveTab('https://crm.example.com/x')
    const w = await mountApp()
    const more = w.get('button[aria-label="Weitere Aktionen: Kunde"]')
    await more.trigger('click')
    await more.trigger('keydown', { key: 'Escape' })
    expect(more.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(more.element)
    w.unmount()
  })

  it('focuses the heading after creating an app', async () => {
    mockActiveTab('https://neu.example.org/start')
    mockPermission('request', true)
    const w = await mountApp()
    await w.get('#new-app-name').setValue('Neu')
    await w.get('form[aria-labelledby="new-app-heading"]').trigger('submit')
    await flushPromises()
    expect(w.get('h1').text()).toBe('Neu, An der Adresse erkannt')
    expect(document.activeElement).toBe(w.get('h1').element)
    w.unmount()
  })

  it('offers to grant a missing host permission', async () => {
    mockActiveTab('https://crm.example.com/x')
    mockPermission('contains', false)
    const request = mockPermission('request', true)
    const w = await mountApp()
    expect(w.text()).toContain('Berechtigung fehlt.')
    const grant = w.findAll('button').find((b) => b.text() === 'Berechtigung erteilen')
    await grant?.trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalled()
    expect(w.text()).not.toContain('Berechtigung fehlt.')
    w.unmount()
  })

  it('offers quick fill as the main action without an app, with mode switch and dataset line', async () => {
    mockActiveTab('https://new.example.com/')
    mockScanAndFill([scanned])
    const w = await mountApp()
    expect(w.find('[data-testid="dataset"]').exists()).toBe(true)
    expect(w.text()).toContain('Alle Felder')
    const button = buttonByText(w, 'Ohne Vorlage füllen')
    expect(button?.classes()).toContain('bg-brand')
    expect(w.text()).toContain('Erkennt die Felder selbst und füllt sie mit Testdaten.')
    await button?.trigger('click')
    await flushPromises()
    expect(w.get('[role="status"]').text()).toBe('Schnellfüllen: 1 von 2 befüllt · 1 nicht gefunden')
    const save = buttonByText(w, 'Als Vorlage speichern')
    expect(save).toBeDefined()
    await save?.trigger('click')
    await flushPromises()
    expect(w.get<HTMLInputElement>('#new-app-template').element.value).toBe('Seite')
    expect(document.activeElement).toBe(w.get('#new-app-name').element)
    // The result must be visible without scrolling: status and offer come before the long new-app form.
    const status = w.get('[role="status"]').element
    const form = w.get('form[aria-labelledby="new-app-heading"]').element
    expect(status.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(w.get('form[aria-labelledby="new-app-heading"] button[type="submit"]').text()).toBe('App und Vorlage anlegen')
    w.unmount()
  })

  it('offers quick fill as a secondary action next to templates and saves the run as template', async () => {
    mockActiveTab('https://crm.example.com/x')
    mockScanAndFill([scanned])
    const w = await mountApp()
    const button = buttonByText(w, 'Ohne Vorlage füllen')
    expect(button).toBeDefined()
    expect(button?.classes()).not.toContain('bg-brand')
    await button?.trigger('click')
    await flushPromises()
    await buttonByText(w, 'Als Vorlage speichern')?.trigger('click')
    await flushPromises()
    const name = w.get<HTMLInputElement>('#quick-template-name')
    expect(name.element.value).toBe('Seite')
    expect(document.activeElement).toBe(name.element)
    await buttonByText(w, 'Abbrechen')?.trigger('click')
    await flushPromises()
    expect(w.find('#quick-template-form').exists()).toBe(false)
    expect(document.activeElement).toBe(buttonByText(w, 'Als Vorlage speichern')?.element)
    await buttonByText(w, 'Als Vorlage speichern')?.trigger('click')
    await flushPromises()
    await name.setValue('Lieferant')
    await w.get('#quick-template-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Lieferant')
    expect(w.get('[role="status"]').text()).toBe('Vorlage „Lieferant“ gespeichert – Felder im Pflege-Tab prüfen.')
    expect(w.find('#quick-template-form').exists()).toBe(false)
    expect(buttonByText(w, 'Als Vorlage speichern')).toBeUndefined()
    expect(document.activeElement).toBe(w.get('h1').element)
    w.unmount()
  })

  it('offers quick fill as the main action for an app without templates', async () => {
    await saveApp({ id: 'shop', name: 'Shop', urlPatterns: ['https://shop.example.com/*'] })
    mockActiveTab('https://shop.example.com/')
    const w = await mountApp()
    expect(buttonByText(w, 'Ohne Vorlage füllen')?.classes()).toContain('bg-brand')
    expect(w.text()).not.toContain('Noch keine Vorlagen für diese App.')
    expect(buttonByText(w, '+ Neue Vorlage')).toBeDefined()
    w.unmount()
  })

  it('hides "Als Vorlage speichern" without a run', async () => {
    mockActiveTab('https://crm.example.com/x')
    const w = await mountApp()
    expect(buttonByText(w, 'Als Vorlage speichern')).toBeUndefined()
    w.unmount()
  })
})
