import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import App from '../../entrypoints/popup/App.vue'
import { recordFillResult } from '../../src/fill/lastReport'
import type { FillReport } from '../../src/fill/runFill'
import { saveApp, saveTemplate } from '../../src/storage/repository'

const report: FillReport = {
  templateId: 't1',
  filled: 1,
  total: 2,
  fields: [
    { fieldId: 'a', label: 'Firmenname', status: 'filled' },
    { fieldId: 'b', label: 'Rechtsform', status: 'missing' },
  ],
}

function mockActiveTab(url: string, id = 7) {
  const query = vi.fn<(info: unknown) => Promise<{ id: number; url: string }[]>>(async () => [{ id, url }])
  vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(query as unknown as typeof fakeBrowser.tabs.query)
}

// The browser APIs are overloaded (promise + callback), so the mocks are typed separately and cast once.
function mockPermission(api: 'request' | 'contains', granted: boolean) {
  const fn = vi.fn<(p: unknown) => Promise<boolean>>(async () => granted)
  vi.spyOn(fakeBrowser.permissions, api).mockImplementation(fn as unknown as typeof fakeBrowser.permissions.request)
  return fn
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
  await saveApp({ id: 'crm', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] })
  await saveTemplate({ id: 't1', appId: 'crm', name: 'Kunde', process: { name: 'Kundenanlage', step: 1 }, fields: [], lastMissing: [] })
})

describe('popup App', () => {
  it('shows the detected app, its templates and the last report in the live status line', async () => {
    await recordFillResult(7, report)
    mockActiveTab('https://crm.example.com/x')
    const w = await mountApp()
    expect(w.get('h1').text()).toBe('CRMerkannt')
    expect(w.text()).toContain('Kundenanlage · Schritt 1')
    const status = w.get('[role="status"]')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toBe('Kunde: 1 von 2 befüllt · 1 nicht gefunden')
    expect(w.get('button[aria-label="Füllen: Kunde"]').text()).toBe('Füllen')
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
    expect(w.get('h1').text()).toBe('Shopmanuell gewählt')
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
    expect(w.get('h1').text()).toBe('Neuerkannt')
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
})
