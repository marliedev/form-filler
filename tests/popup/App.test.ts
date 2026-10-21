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
})
