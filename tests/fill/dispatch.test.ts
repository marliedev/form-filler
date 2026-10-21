import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { dispatchFill, fillLastUsed, startRecording } from '../../src/fill/dispatch'
import { getLastReport } from '../../src/fill/lastReport'
import type { FillReport } from '../../src/fill/runFill'
import type { ContentMessage } from '../../src/fill/messages'
import type { Template } from '../../src/model/types'
import { getPrefs, getTemplate, saveTemplate, setPrefs } from '../../src/storage/repository'

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

function firstMessage(send: ReturnType<typeof mockMessaging>['send']): [number, ContentMessage] {
  const call = send.mock.calls[0]
  if (!call) throw new Error('no message sent')
  return call
}

function mockActiveTab(id: number) {
  const query = vi.fn<(info: unknown) => Promise<{ id: number }[]>>(async () => [{ id }])
  vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(query as unknown as typeof fakeBrowser.tabs.query)
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

describe('fillLastUsed', () => {
  it('fills the active tab with the last template and the saved mode', async () => {
    await saveTemplate(tpl)
    await setPrefs({ lastTemplateId: 't1', mode: 'required' })
    mockActiveTab(5)
    const { send } = mockMessaging()
    await fillLastUsed()
    const [tabId, message] = firstMessage(send)
    expect(tabId).toBe(5)
    expect(message).toMatchObject({ type: 'fill', mode: 'required' })
  })

  it('does nothing when the last template was deleted', async () => {
    await setPrefs({ lastTemplateId: 'deleted' })
    mockActiveTab(5)
    const { execute } = mockMessaging()
    await fillLastUsed()
    expect(execute).not.toHaveBeenCalled()
  })

  it('does nothing without a last template', async () => {
    const { execute } = mockMessaging()
    await fillLastUsed()
    expect(execute).not.toHaveBeenCalled()
  })
})
