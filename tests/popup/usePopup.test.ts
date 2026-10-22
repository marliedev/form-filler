import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { getLastReport, recordFillResult } from '../../src/fill/lastReport'
import type { ContentMessage } from '../../src/fill/messages'
import type { FillReport } from '../../src/fill/runFill'
import type { AppDef, Template } from '../../src/model/types'
import { usePopup } from '../../src/popup/usePopup'
import { getPrefs, listApps, listTemplates, saveApp, saveTemplate, setPrefs } from '../../src/storage/repository'

const crm: AppDef = { id: 'crm', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] }
const shop: AppDef = { id: 'shop', name: 'Shop', urlPatterns: ['https://shop.example.com/*'] }
const tpl: Template = { id: 't1', appId: 'crm', name: 'Kunde', process: null, fields: [], lastMissing: [] }
const shopTpl: Template = { ...tpl, id: 't2', appId: 'shop', name: 'Bestellung' }

const report: FillReport = {
  templateId: 't1',
  filled: 1,
  total: 2,
  fields: [
    { fieldId: 'a', label: 'A', status: 'filled' },
    { fieldId: 'b', label: 'B', status: 'missing' },
  ],
}

// The browser APIs are overloaded (promise + callback), so the mocks are typed separately and cast once.
function mockActiveTab(url: string, id = 7) {
  const query = vi.fn<(info: unknown) => Promise<{ id: number; url: string }[]>>(async () => [{ id, url }])
  vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(query as unknown as typeof fakeBrowser.tabs.query)
}

function mockMessaging(response: unknown = report) {
  const execute = vi.fn<(injection: unknown) => Promise<unknown[]>>(async () => [])
  const send = vi.fn<(tabId: number, message: ContentMessage) => Promise<unknown>>(async () => response)
  vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(execute as unknown as typeof fakeBrowser.scripting.executeScript)
  vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation(send as unknown as typeof fakeBrowser.tabs.sendMessage)
  return { execute, send }
}

function mockPermissionRequest(granted: boolean | Promise<boolean>) {
  const request = vi.fn<(p: unknown) => Promise<boolean>>(() => Promise.resolve(granted))
  vi.spyOn(fakeBrowser.permissions, 'request').mockImplementation(request as unknown as typeof fakeBrowser.permissions.request)
  return request
}

function mockPermissionContains(granted: boolean) {
  const contains = vi.fn<(p: unknown) => Promise<boolean>>(async () => granted)
  vi.spyOn(fakeBrowser.permissions, 'contains').mockImplementation(contains as unknown as typeof fakeBrowser.permissions.contains)
  return contains
}

beforeEach(async () => {
  fakeBrowser.reset()
  vi.restoreAllMocks()
  await saveApp(crm)
  await saveApp(shop)
  await saveTemplate(tpl)
  await saveTemplate(shopTpl)
})

describe('usePopup', () => {
  it('detects the app of the active tab and lists its templates', async () => {
    mockActiveTab('https://crm.example.com/kunden/neu')
    const p = usePopup()
    await p.load()
    expect(p.app.value?.id).toBe('crm')
    expect(p.detected.value).toBe(true)
    expect(p.templates.value.map((t) => t.id)).toEqual(['t1'])
    expect(p.apps.value).toHaveLength(2)
  })

  it('has no app without a match and suggests a pattern for the page origin', async () => {
    mockActiveTab('https://other.example.org/a/b?c=1')
    const p = usePopup()
    await p.load()
    expect(p.app.value).toBeNull()
    expect(p.templates.value).toEqual([])
    expect(p.pageSupported.value).toBe(true)
    expect(p.suggestedPattern.value).toBe('https://other.example.org/*')
  })

  it('marks browser-internal pages as unsupported', async () => {
    mockActiveTab('chrome://extensions/')
    const p = usePopup()
    await p.load()
    expect(p.pageSupported.value).toBe(false)
  })

  it('loads the mode from prefs and stores it when switched', async () => {
    await setPrefs({ mode: 'required' })
    mockActiveTab('https://crm.example.com/')
    const p = usePopup()
    await p.load()
    expect(p.mode.value).toBe('required')
    await p.setMode('all')
    expect(p.mode.value).toBe('all')
    expect((await getPrefs()).mode).toBe('all')
  })

  it('shows the last report of the active tab on open', async () => {
    await recordFillResult(7, report)
    mockActiveTab('https://crm.example.com/')
    const p = usePopup()
    await p.load()
    expect(p.report.value).toEqual(report)
  })

  it('fill sets the report and resets busy', async () => {
    mockActiveTab('https://crm.example.com/')
    const { send } = mockMessaging()
    const p = usePopup()
    await p.load()
    const running = p.fill('t1')
    expect(p.busy.value).toBe(true)
    await running
    expect(p.report.value).toEqual(report)
    expect(p.error.value).toBeNull()
    expect(p.busy.value).toBe(false)
    expect(send.mock.calls[0]?.[0]).toBe(7)
  })

  it('puts a German error into error when dispatchFill fails', async () => {
    mockActiveTab('https://crm.example.com/')
    const { execute } = mockMessaging()
    execute.mockRejectedValue(new Error('Cannot access a chrome:// URL'))
    const p = usePopup()
    await p.load()
    await p.fill('t1')
    expect(p.error.value?.message).toBe('Auf dieser Seite können keine Formulare befüllt werden.')
    expect(p.report.value).toBeNull()
    expect(p.busy.value).toBe(false)
  })

  it('surfaces a content-side run error', async () => {
    mockActiveTab('https://crm.example.com/')
    mockMessaging({ templateId: 't1', filled: 0, total: 0, fields: [], error: 'Ungültige Vorlage – Befüllen nicht möglich' })
    const p = usePopup()
    await p.load()
    await p.fill('t1')
    expect(p.error.value?.message).toBe('Ungültige Vorlage – Befüllen nicht möglich.')
  })

  it('newDataset clears the datasets and the report of the tab and confirms it', async () => {
    await recordFillResult(7, report)
    await fakeBrowser.storage.session.set({ 'ds:7:x': { runId: 'T0001' } })
    mockActiveTab('https://crm.example.com/')
    const p = usePopup()
    await p.load()
    await p.newDataset()
    expect(await fakeBrowser.storage.session.get('ds:7:x')).toEqual({})
    expect(await getLastReport(7)).toBeNull()
    expect(p.report.value).toBeNull()
    expect(await fakeBrowser.action.getBadgeText({ tabId: 7 })).toBe('')
    expect(p.notice.value).toMatch(/Neuer Datensatz/)
  })

  it('chooseApp switches to another app and its templates', async () => {
    mockActiveTab('https://crm.example.com/')
    const p = usePopup()
    await p.load()
    await p.chooseApp('shop')
    expect(p.app.value?.id).toBe('shop')
    expect(p.detected.value).toBe(false)
    expect(p.templates.value.map((t) => t.id)).toEqual(['t2'])
  })

  it('creates an app for the current page after the host permission was granted', async () => {
    mockActiveTab('https://neu.example.org/start')
    const request = mockPermissionRequest(true)
    const p = usePopup()
    await p.load()
    await p.createAppForCurrentPage('  Neu  ', 'https://neu.example.org/*')
    expect(request).toHaveBeenCalledWith({ origins: ['https://neu.example.org/*'] })
    expect(p.app.value).toMatchObject({ name: 'Neu', urlPatterns: ['https://neu.example.org/*'] })
    expect(p.detected.value).toBe(true)
    expect((await listApps()).map((a) => a.name)).toContain('Neu')
  })

  it('does not save the app when the permission is denied', async () => {
    mockActiveTab('https://neu.example.org/start')
    mockPermissionRequest(false)
    const p = usePopup()
    await p.load()
    await p.createAppForCurrentPage('Neu', 'https://neu.example.org/*')
    expect(p.app.value).toBeNull()
    expect(await listApps()).toHaveLength(2)
    expect(p.error.value?.message).toMatch(/Berechtigung/)
  })

  it('rejects an empty app name without asking for permissions', async () => {
    mockActiveTab('https://neu.example.org/start')
    const request = mockPermissionRequest(true)
    const p = usePopup()
    await p.load()
    await p.createAppForCurrentPage('  ', 'https://neu.example.org/*')
    expect(request).not.toHaveBeenCalled()
    expect(p.error.value?.message).toBe('Bitte einen Namen eingeben.')
  })

  it('newTemplate saves an empty template and starts recording', async () => {
    mockActiveTab('https://crm.example.com/')
    const { send } = mockMessaging({ ok: true })
    const p = usePopup()
    await p.load()
    await p.newTemplate('Ansprechpartner')
    const created = (await listTemplates('crm')).find((t) => t.name === 'Ansprechpartner')
    expect(created).toMatchObject({ appId: 'crm', process: null, fields: [], lastMissing: [] })
    expect(p.templates.value).toHaveLength(2)
    expect(send).toHaveBeenCalledWith(7, { type: 'record:start', templateId: created?.id })
    expect(p.error.value).toBeNull()
  })

  it('surfaces a failing recording start as a German error', async () => {
    mockActiveTab('https://crm.example.com/')
    const { send } = mockMessaging()
    send.mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'))
    const p = usePopup()
    await p.load()
    await p.record('t1')
    expect(p.error.value?.message).toMatch(/^Die Seite hat nicht geantwortet/)
    expect(p.busy.value).toBe(false)
  })

  it('shows the content script refusal of a second recording in German', async () => {
    mockActiveTab('https://crm.example.com/')
    const error = 'Auf der Seite läuft noch eine Aufnahme mit ungespeicherten Änderungen. Bitte zuerst speichern oder beenden.'
    mockMessaging({ ok: false, error })
    const p = usePopup()
    await p.load()
    await p.record('t1')
    expect(p.error.value).toEqual({ message: error })
    expect(p.notice.value).toBe('')
  })

  it('openManage opens the manage page in a new tab', async () => {
    mockActiveTab('https://crm.example.com/')
    const create = vi.fn<(props: { url?: string }) => Promise<unknown>>(async () => ({}))
    vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(create as unknown as typeof fakeBrowser.tabs.create)
    const p = usePopup()
    await p.load()
    await p.openManage()
    expect(create.mock.calls[0]?.[0].url).toMatch(/\/manage\.html$/)
  })

  it('reports a failing load in German instead of staying empty', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockRejectedValue(new Error('boom'))
    const p = usePopup()
    await p.load()
    expect(p.error.value).toEqual({ message: 'Popup konnte nicht geladen werden.', detail: 'boom' })
  })

  it('newTemplate reports a storage error instead of rejecting', async () => {
    mockActiveTab('https://crm.example.com/')
    const { send } = mockMessaging(undefined)
    const p = usePopup()
    await p.load()
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'))
    await expect(p.newTemplate('Neu')).resolves.toBe(false)
    expect(p.error.value?.message).toBe('Vorlage konnte nicht gespeichert werden.')
    expect(send).not.toHaveBeenCalled()
    expect(p.busy.value).toBe(false)
  })

  it('newTemplate does nothing while another action runs', async () => {
    mockActiveTab('https://crm.example.com/')
    const { send } = mockMessaging()
    const p = usePopup()
    await p.load()
    const filling = p.fill('t1')
    await expect(p.newTemplate('Neu')).resolves.toBe(false)
    await filling
    expect((await listTemplates('crm')).map((t) => t.name)).toEqual(['Kunde'])
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('saves the app before the permission prompt settles (the popup may close meanwhile)', async () => {
    mockActiveTab('https://neu.example.org/start')
    const request = mockPermissionRequest(new Promise<boolean>(() => undefined))
    const p = usePopup()
    await p.load()
    void p.createAppForCurrentPage('Neu', 'https://neu.example.org/*')
    void p.createAppForCurrentPage('Neu', 'https://neu.example.org/*')
    await vi.waitFor(async () => expect((await listApps()).map((a) => a.name)).toContain('Neu'))
    expect(request).toHaveBeenCalledTimes(1)
    expect((await listApps()).filter((a) => a.name === 'Neu')).toHaveLength(1)
  })

  it('removes the app again when the pattern is rejected by the browser', async () => {
    mockActiveTab('https://neu.example.org/start')
    vi.spyOn(fakeBrowser.permissions, 'request').mockRejectedValue(new Error("Invalid value for origin pattern 'x'"))
    const p = usePopup()
    await p.load()
    await expect(p.createAppForCurrentPage('Neu', 'x')).resolves.toBe(false)
    expect(await listApps()).toHaveLength(2)
    expect(p.error.value?.message).toMatch(/URL-Muster ist ungültig/)
  })

  it('flags a detected app without granted host permission and re-requests it', async () => {
    mockActiveTab('https://crm.example.com/')
    const contains = mockPermissionContains(false)
    const request = mockPermissionRequest(true)
    const p = usePopup()
    await p.load()
    expect(contains).toHaveBeenCalledWith({ origins: ['https://crm.example.com/*'] })
    expect(p.permissionMissing.value).toBe(true)
    await p.grantPermission()
    expect(request).toHaveBeenCalledWith({ origins: ['https://crm.example.com/*'] })
    expect(p.permissionMissing.value).toBe(false)
  })

  it('does not flag a manually chosen app', async () => {
    mockActiveTab('https://crm.example.com/')
    mockPermissionContains(false)
    const p = usePopup()
    await p.load()
    await p.chooseApp('shop')
    expect(p.permissionMissing.value).toBe(false)
  })
})
