import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { dispatchFill, fillByShortcut, quickFill, startRecording, undoLastRun } from '../../src/fill/dispatch'
import { getLastReport, recordFillResult } from '../../src/fill/lastReport'
import type { FillReport } from '../../src/fill/runFill'
import type { ContentMessage } from '../../src/fill/messages'
import type { FieldRule, Template } from '../../src/model/types'
import { getPrefs, getTemplate, saveApp, saveTemplate, setPrefs } from '../../src/storage/repository'
import { getQuickRun } from '../../src/storage/quickRunStore'

const tpl: Template = {
  id: 't1', appId: 'app', name: 'Vorlage', process: { name: 'Kundenanlage', step: 1 }, fields: [], lastMissing: ['old'],
}

const report: FillReport = {
  templateId: 't1',
  filled: 1,
  total: 5,
  fields: [
    { fieldId: 'a', label: 'A', status: 'filled' },
    { fieldId: 'b', label: 'B', status: 'missing' },
    { fieldId: 'c', label: 'C', status: 'ambiguous' },
    { fieldId: 'd', label: 'D', status: 'failed', detail: 'kaputt' },
    { fieldId: 'e', label: 'E', status: 'skipped', detail: 'Optional' },
  ],
}

// The browser APIs are overloaded (promise + callback), so the mocks are typed separately and cast once.
function mockMessaging(response: unknown = report) {
  const execute = vi.fn<(injection: unknown) => Promise<unknown[]>>(async () => [])
  const send = vi.fn<(tabId: number, message: ContentMessage) => Promise<unknown>>(async () => response)
  vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(execute as unknown as typeof fakeBrowser.scripting.executeScript)
  vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation(send as unknown as typeof fakeBrowser.tabs.sendMessage)
  return { execute, send }
}

/** Answers `scan` with the given fields and every other message with `response`. */
function mockScanAndFill(fields: FieldRule[], response: unknown = quickReport) {
  const { execute, send } = mockMessaging(response)
  send.mockImplementation(async (_tab, message) => (message.type === 'scan' ? { ok: true, fields } : response))
  return { execute, send }
}

/** runFill reports the id of the template it ran with, so a quick fill answers with 'quick'. */
const quickReport: FillReport = { ...report, templateId: 'quick' }

const scanned: FieldRule = {
  id: 'a', label: 'A', locator: { kind: 'text', name: 'a' }, config: { type: 'companyName' }, slot: null, required: false, appendRunId: false,
}
const page = { url: 'https://x.example.com/a?b#c', title: 'Seite' }

function firstMessage(send: ReturnType<typeof mockMessaging>['send']): [number, ContentMessage] {
  const call = send.mock.calls[0]
  if (!call) throw new Error('no message sent')
  return call
}

function mockActiveTab(id?: number, url?: string) {
  const query = vi.fn<(info: unknown) => Promise<{ id: number; url?: string }[]>>(async () => (id === undefined ? [] : [{ id, url }]))
  vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(query as unknown as typeof fakeBrowser.tabs.query)
  return query
}

beforeEach(() => {
  fakeBrowser.reset()
  vi.restoreAllMocks()
})

describe('dispatchFill', () => {
  it('injects the content script, sends the fill message and returns the report', async () => {
    await saveTemplate(tpl)
    const { execute, send } = mockMessaging()
    const result = await dispatchFill(3, 't1', 'required')
    expect(result).toEqual(report)
    expect(execute).toHaveBeenCalledWith({ target: { tabId: 3 }, files: ['/content-scripts/content.js'] })
    const [tabId, message] = firstMessage(send)
    expect(tabId).toBe(3)
    expect(message.type).toBe('fill')
    if (message.type !== 'fill') return
    expect(message.template).toEqual(tpl)
    expect(message.mode).toBe('required')
    expect(message.dataset.runId).toMatch(/^T\d{4}$/)
  })

  it('stores lastTemplateId and the missing ids in the template', async () => {
    await saveTemplate(tpl)
    mockMessaging()
    await dispatchFill(3, 't1', 'all')
    expect((await getPrefs()).lastTemplateId).toBe('t1')
    expect((await getTemplate('t1'))?.lastMissing).toEqual(['b', 'c', 'd'])
  })

  it('only patches lastMissing so template edits made during the run survive', async () => {
    await saveTemplate(tpl)
    const { send } = mockMessaging()
    send.mockImplementation(async () => {
      await saveTemplate({ ...tpl, name: 'Umbenannt' })
      return report
    })
    await dispatchFill(3, 't1', 'all')
    const saved = await getTemplate('t1')
    expect(saved?.name).toBe('Umbenannt')
    expect(saved?.lastMissing).toEqual(['b', 'c', 'd'])
  })

  it('in mode required keeps the markers of optional fields that were not tried', async () => {
    const rule = (id: string, required: boolean) => ({
      id, label: id, locator: { kind: 'text' as const, name: id }, config: { type: 'text' as const }, slot: null, required, appendRunId: false,
    })
    await saveTemplate({ ...tpl, fields: [rule('a', true), rule('b', true), rule('opt', false)], lastMissing: ['a', 'opt'] })
    mockMessaging({
      templateId: 't1', filled: 1, total: 2,
      fields: [
        { fieldId: 'a', label: 'a', status: 'filled' },
        { fieldId: 'b', label: 'b', status: 'missing' },
        { fieldId: 'opt', label: 'opt', status: 'skipped', detail: 'Optional' },
      ],
    })
    await dispatchFill(3, 't1', 'required')
    expect((await getTemplate('t1'))?.lastMissing).toEqual(['opt', 'b'])
  })

  it('keeps lastMissing when the content side reports an error', async () => {
    await saveTemplate(tpl)
    mockMessaging({ templateId: 't1', filled: 0, total: 0, fields: [], error: 'Ungültige Nachricht' })
    const result = await dispatchFill(3, 't1', 'all')
    expect(result.error).toBe('Ungültige Nachricht')
    expect((await getTemplate('t1'))?.lastMissing).toEqual(['old'])
  })

  it('throws a German error for an unknown template', async () => {
    const { execute } = mockMessaging()
    await expect(dispatchFill(3, 'nope', 'all')).rejects.toThrow('Vorlage nicht gefunden')
    expect(execute).not.toHaveBeenCalled()
  })

  it('throws when the page does not answer', async () => {
    await saveTemplate(tpl)
    mockMessaging(null)
    await expect(dispatchFill(3, 't1', 'all')).rejects.toThrow()
  })

  it('remembers the report for the tab and sets the badge', async () => {
    await saveTemplate(tpl)
    mockMessaging()
    await dispatchFill(3, 't1', 'all')
    expect(await getLastReport(3)).toEqual(report)
    expect(await fakeBrowser.action.getBadgeText({ tabId: 3 })).toBe('3')
  })

  it('remembers a failed run as an error report so shortcut runs are not silent', async () => {
    await saveTemplate(tpl)
    const { execute } = mockMessaging()
    execute.mockRejectedValue(new Error('Cannot access a chrome:// URL'))
    await expect(dispatchFill(3, 't1', 'all')).rejects.toThrow('Cannot access a chrome:// URL')
    expect(await getLastReport(3)).toEqual({ templateId: 't1', filled: 0, total: 0, fields: [], error: 'Cannot access a chrome:// URL' })
    expect(await fakeBrowser.action.getBadgeText({ tabId: 3 })).toBe('!')
  })
})

describe('startRecording', () => {
  it('injects the content script and sends record:start', async () => {
    const { execute, send } = mockMessaging({ ok: true })
    await startRecording(4, 't9')
    expect(execute).toHaveBeenCalledWith({ target: { tabId: 4 }, files: ['/content-scripts/content.js'] })
    expect(send).toHaveBeenCalledWith(4, { type: 'record:start', templateId: 't9' })
  })

  it('throws the German error the content script answers with', async () => {
    mockMessaging({ ok: false, error: 'Vorlage nicht gefunden' })
    await expect(startRecording(4, 't9')).rejects.toThrow('Vorlage nicht gefunden')
  })

  it('throws when the page does not answer', async () => {
    mockMessaging(undefined)
    await expect(startRecording(4, 't9')).rejects.toThrow('Die Seite hat nicht geantwortet')
  })
})

describe('fillByShortcut', () => {
  it('fills the active tab of a known app with its template and the saved mode', async () => {
    await saveApp({ id: 'app', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] })
    await saveTemplate(tpl)
    await setPrefs({ lastTemplateId: 't1', mode: 'required' })
    mockActiveTab(5, 'https://crm.example.com/kunden')
    const { send } = mockMessaging()
    await fillByShortcut()
    const [tabId, message] = firstMessage(send)
    expect(tabId).toBe(5)
    expect(message).toMatchObject({ type: 'fill', mode: 'required', template: { id: 't1' } })
  })

  it('queries the active tab of the last focused window', async () => {
    await saveApp({ id: 'app', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] })
    await saveTemplate(tpl)
    await setPrefs({ lastTemplateId: 't1' })
    const query = mockActiveTab(5, 'https://crm.example.com/')
    mockMessaging()
    await fillByShortcut()
    expect(query).toHaveBeenCalledWith({ active: true, lastFocusedWindow: true })
  })

  it('on a page without a known app fills without a template, even when a template was used last', async () => {
    await saveApp({ id: 'app', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] })
    await saveTemplate(tpl)
    await setPrefs({ lastTemplateId: 't1' })
    mockActiveTab(5, 'https://other.example.com/kontakt')
    const { send } = mockScanAndFill([scanned])
    expect(await fillByShortcut()).toEqual(quickReport)
    expect(send.mock.calls.map((c) => c[1].type)).toEqual(['scan', 'fill', 'scan'])
    expect((await getPrefs()).lastTemplateId).toBe('t1')
  })

  it('falls back to a quick fill when the last template was deleted', async () => {
    await setPrefs({ lastTemplateId: 'deleted' })
    mockActiveTab(5, 'https://x.example.com/a')
    const { send } = mockScanAndFill([scanned])
    expect(await fillByShortcut()).toEqual(quickReport)
    expect(send.mock.calls.map((c) => c[1].type)).toEqual(['scan', 'fill', 'scan'])
    expect((await getLastReport(5))?.templateId).toBe('quick')
    expect((await getQuickRun(5))?.url).toBe('https://x.example.com/a')
    expect((await getPrefs()).lastTemplateId).toBe('deleted')
  })

  it('falls back to a quick fill without a last template', async () => {
    mockActiveTab(5, 'https://x.example.com/a')
    const { send } = mockScanAndFill([scanned])
    expect(await fillByShortcut()).toEqual(quickReport)
    expect(send.mock.calls.map((c) => c[1].type)).toEqual(['scan', 'fill', 'scan'])
    expect(await fakeBrowser.action.getBadgeText({ tabId: 5 })).toBe('3')
  })

  it('does nothing without an active tab', async () => {
    mockActiveTab()
    const { execute } = mockMessaging()
    expect(await fillByShortcut()).toBeNull()
    expect(execute).not.toHaveBeenCalled()
  })

  it('on a page of a known app continues with the next step of the process used last', async () => {
    await saveApp({ id: 'app', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] })
    await saveTemplate(tpl)
    await saveTemplate({ ...tpl, id: 't2', process: { name: 'Kundenanlage', step: 2 } })
    await setPrefs({ lastTemplateId: 't1' })
    mockActiveTab(5, 'https://crm.example.com/kunden/neu')
    const { send } = mockMessaging()
    await fillByShortcut()
    expect(firstMessage(send)[1]).toMatchObject({ type: 'fill', template: { id: 't2' } })
    expect((await getPrefs()).lastTemplateId).toBe('t2')
  })

  it('on a page of a known app takes its only template even when another app was used last', async () => {
    await saveApp({ id: 'app', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] })
    await saveApp({ id: 'shop', name: 'Shop', urlPatterns: ['https://shop.example.com/*'] })
    await saveTemplate(tpl)
    await saveTemplate({ ...tpl, id: 'order', appId: 'shop', process: null })
    await setPrefs({ lastTemplateId: 't1' })
    mockActiveTab(5, 'https://shop.example.com/checkout')
    const { send } = mockMessaging()
    await fillByShortcut()
    expect(firstMessage(send)[1]).toMatchObject({ type: 'fill', template: { id: 'order' } })
  })

  it('falls back to a quick fill when the detected app has no template yet', async () => {
    await saveApp({ id: 'app', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] })
    await saveTemplate({ ...tpl, id: 'order', appId: 'shop', process: null })
    await setPrefs({ lastTemplateId: 'order' })
    mockActiveTab(5, 'https://crm.example.com/')
    const { send } = mockScanAndFill([scanned])
    expect(await fillByShortcut()).toEqual(quickReport)
    expect(send.mock.calls.map((c) => c[1].type)).toEqual(['scan', 'fill', 'scan'])
    expect((await getPrefs()).lastTemplateId).toBe('order')
  })
})

/** Answers successive `scan` messages with the given field lists (the last one repeats) and every `fill` with a report of the template it received. */
function mockScanSequence(scans: FieldRule[][]) {
  const { execute, send } = mockMessaging()
  let scanCount = 0
  send.mockImplementation(async (_tab, message) => {
    if (message.type === 'scan') {
      const fields = scans[Math.min(scanCount, scans.length - 1)] ?? []
      scanCount++
      return { ok: true, fields }
    }
    if (message.type === 'fill') {
      const fields = message.template.fields.map((f) => ({ fieldId: f.id, label: f.label, status: 'filled' as const }))
      return { templateId: message.template.id, filled: fields.length, total: fields.length, fields }
    }
    return undefined
  })
  return { execute, send }
}

const billing: FieldRule = {
  id: 'b', label: 'Rechnung: PLZ', locator: { kind: 'text', name: 'billing_zip' }, config: { type: 'zip' }, slot: 'B', required: false, appendRunId: false,
}

describe('quickFill – conditional fields', () => {
  it('scans again after the first pass and fills fields that appeared, with the same dataset', async () => {
    const { send } = mockScanSequence([[scanned], [scanned, billing]])
    const result = await quickFill(5, 'all', page)
    const types = send.mock.calls.map((c) => c[1].type)
    expect(types).toEqual(['scan', 'fill', 'scan', 'fill', 'scan'])
    const first = send.mock.calls[1]?.[1]
    const second = send.mock.calls[3]?.[1]
    if (first?.type !== 'fill' || second?.type !== 'fill') throw new Error('fill messages')
    expect(second.template.fields.map((f) => f.locator.name)).toEqual(['billing_zip'])
    expect(second.dataset.runId).toBe(first.dataset.runId)
    expect(second.dataset.addresses.B).toBeDefined()
    // The extra pass continues the page's run, so undo takes both passes back.
    expect(first.continueRun).toBeUndefined()
    expect(second.continueRun).toBe(true)
    expect(result.fields.map((f) => f.label)).toEqual(['A', 'Rechnung: PLZ'])
    expect(result.filled).toBe(2)
    expect((await getQuickRun(5))?.fields.map((f) => f.locator.name)).toEqual(['a', 'billing_zip'])
  })

  it('stops after two extra passes even when fields keep appearing', async () => {
    const more = (name: string): FieldRule => ({ ...billing, id: name, label: name, locator: { kind: 'text', name } })
    const { send } = mockScanSequence([[scanned], [scanned, more('x')], [scanned, more('x'), more('y')], [scanned, more('x'), more('y'), more('z')]])
    const result = await quickFill(5, 'all', page)
    expect(send.mock.calls.filter((c) => c[1].type === 'fill')).toHaveLength(3)
    expect(result.fields.map((f) => f.label)).toEqual(['A', 'x', 'y'])
  })

  it('does not scan again when nothing new appears', async () => {
    const { send } = mockScanSequence([[scanned]])
    await quickFill(5, 'all', page)
    expect(send.mock.calls.map((c) => c[1].type)).toEqual(['scan', 'fill', 'scan'])
  })
})

describe('quickFill', () => {
  it('scans the page, fills with an ad-hoc template and keeps the run for the tab', async () => {
    const { send } = mockScanAndFill([scanned])
    const result = await quickFill(5, 'required', page)
    expect(result).toEqual(quickReport)
    expect(send.mock.calls[0]?.[1]).toEqual({ type: 'scan' })
    const fill = send.mock.calls[1]?.[1]
    expect(fill).toMatchObject({
      type: 'fill', mode: 'required',
      template: { id: 'quick', name: 'Schnellfüllen', appId: '', process: null, fields: [scanned], lastMissing: [] },
    })
    expect(await getQuickRun(5)).toEqual({ fields: [scanned], problems: ['b', 'c', 'd'], url: page.url, title: 'Seite' })
    expect((await getLastReport(5))?.templateId).toBe('quick')
    expect(await fakeBrowser.action.getBadgeText({ tabId: 5 })).toBe('3')
    expect((await getPrefs()).lastTemplateId).toBeNull()
    expect(await getTemplate('quick')).toBeUndefined()
  })

  it('starts a new dataset on every run', async () => {
    const { send } = mockScanAndFill([scanned])
    await quickFill(5, 'all', page)
    await quickFill(5, 'all', page)
    const fills = send.mock.calls.map((c) => c[1]).filter((m) => m.type === 'fill')
    const first = fills[0]
    const second = fills[1]
    expect(first?.type).toBe('fill')
    expect(second?.type).toBe('fill')
    if (first?.type !== 'fill' || second?.type !== 'fill') return
    expect(second.dataset.company.name).not.toBe(first.dataset.company.name)
  })

  it('reports an error when the page has no fields and sends no fill', async () => {
    const { send } = mockScanAndFill([])
    await expect(quickFill(5, 'all', page)).rejects.toThrow('Keine Formularfelder auf dieser Seite erkannt.')
    expect(send).toHaveBeenCalledTimes(1)
    expect((await getLastReport(5))?.error).toBe('Keine Formularfelder auf dieser Seite erkannt.')
    expect(await fakeBrowser.action.getBadgeText({ tabId: 5 })).toBe('!')
    expect(await getQuickRun(5)).toBeNull()
  })

  it('reports a scan failure', async () => {
    const { send } = mockMessaging()
    send.mockImplementation(async () => ({ ok: false, error: 'kaputt' }))
    await expect(quickFill(5, 'all', page)).rejects.toThrow('kaputt')
    expect((await getLastReport(5))?.error).toBe('kaputt')
    expect(await getQuickRun(5)).toBeNull()
  })
})

describe('undoLastRun', () => {
  it('injects the content script, sends undo and clears report and badge', async () => {
    await recordFillResult(5, report)
    const { execute, send } = mockMessaging({ ok: true, restored: 2, kept: [] })
    expect(await undoLastRun(5)).toEqual({ ok: true, restored: 2, kept: [] })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(firstMessage(send)[1]).toEqual({ type: 'undo' })
    expect(await getLastReport(5)).toBeNull()
    expect(await fakeBrowser.action.getBadgeText({ tabId: 5 })).toBe('')
  })

  it('drops the stale report and badge when the page has nothing to undo', async () => {
    await recordFillResult(5, report)
    mockMessaging({ ok: false, error: 'Nichts zum Zurücknehmen – die Seite wurde seit dem letzten Lauf neu geladen.' })
    const result = await undoLastRun(5)
    expect(result.ok).toBe(false)
    expect(await getLastReport(5)).toBeNull()
    expect(await fakeBrowser.action.getBadgeText({ tabId: 5 })).toBe('')
  })
})
