import { fakerDE } from '@faker-js/faker'
import { browser } from 'wxt/browser'
import { getOrCreateDataset } from '../storage/datasetStore'
import { getPrefs, getTemplate, saveTemplate, setPrefs } from '../storage/repository'
import { recordFillResult } from './lastReport'
import type { ContentMessage, FillMode, RecordStartResponse } from './messages'
import { isProblem } from './reportSummary'
import type { FillReport } from './runFill'

const CONTENT_SCRIPT = '/content-scripts/content.js'
export const NO_LAST_TEMPLATE = 'Noch keine Vorlage genutzt – zuerst im Popup füllen.'

/** The content script guards itself against double registration, so injecting on every call is safe. */
async function injectContentScript(tabId: number): Promise<void> {
  await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] })
}

function isFillReport(value: unknown): value is FillReport {
  return typeof value === 'object' && value !== null && Array.isArray((value as FillReport).fields)
}

function isRecordStartResponse(value: unknown): value is RecordStartResponse {
  if (typeof value !== 'object' || value === null) return false
  const { ok, error } = value as { ok?: unknown; error?: unknown }
  return ok === true || (ok === false && typeof error === 'string')
}

/** Every run (popup or shortcut) leaves its result in the tab's last report and badge, failures included. */
export async function dispatchFill(tabId: number, templateId: string, mode: FillMode): Promise<FillReport> {
  let report: FillReport
  try {
    report = await runDispatch(tabId, templateId, mode)
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await remember(tabId, { templateId, filled: 0, total: 0, fields: [], error })
    throw e
  }
  await remember(tabId, report)
  return report
}

/** Bookkeeping only (e.g. the tab may be gone by now); must not turn a finished run into a failure. */
async function remember(tabId: number, report: FillReport): Promise<void> {
  await recordFillResult(tabId, report).catch((e: unknown) => console.warn('Form Filler: Ergebnis nicht gespeichert', e))
}

async function runDispatch(tabId: number, templateId: string, mode: FillMode): Promise<FillReport> {
  const template = await getTemplate(templateId)
  if (!template) throw new Error('Vorlage nicht gefunden')

  const dataset = await getOrCreateDataset(tabId, template, fakerDE)
  await injectContentScript(tabId)
  const message: ContentMessage = { type: 'fill', template, dataset, mode }
  const report: unknown = await browser.tabs.sendMessage(tabId, message)
  if (!isFillReport(report)) throw new Error('Die Seite hat nicht geantwortet')

  await setPrefs({ lastTemplateId: template.id })
  if (report.error === undefined) await updateLastMissing(templateId, report, mode)
  return report
}

/**
 * Re-reads the template so edits made during the run are kept and only `lastMissing` changes.
 * Fields skipped as optional in mode 'required' were not tried, so their old marker stays.
 */
async function updateLastMissing(templateId: string, report: FillReport, mode: FillMode): Promise<void> {
  const latest = await getTemplate(templateId)
  if (!latest) return
  const problems = report.fields.filter((f) => isProblem(f.status)).map((f) => f.fieldId)
  const untried = new Set(mode === 'required' ? latest.fields.filter((f) => !f.required).map((f) => f.id) : [])
  const kept = latest.lastMissing.filter((id) => untried.has(id) && !problems.includes(id))
  await saveTemplate({ ...latest, lastMissing: [...kept, ...problems] })
}

export async function startRecording(tabId: number, templateId: string): Promise<void> {
  await injectContentScript(tabId)
  const message: ContentMessage = { type: 'record:start', templateId }
  const response: unknown = await browser.tabs.sendMessage(tabId, message)
  if (!isRecordStartResponse(response)) throw new Error('Die Seite hat nicht geantwortet')
  if (!response.ok) throw new Error(response.error)
}

/**
 * Keyboard shortcut: refill the active tab with the last used template. Without one (anymore)
 * the tab gets an error report and badge instead, so the shortcut never fails silently.
 */
export async function fillLastUsed(): Promise<FillReport | null> {
  const { mode, lastTemplateId } = await getPrefs()
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id === undefined) return null
  if (lastTemplateId === null || !(await getTemplate(lastTemplateId))) {
    await remember(tab.id, { templateId: lastTemplateId ?? '', filled: 0, total: 0, fields: [], error: NO_LAST_TEMPLATE })
    return null
  }
  return dispatchFill(tab.id, lastTemplateId, mode)
}
