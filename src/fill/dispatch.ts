import { fakerDE } from '@faker-js/faker'
import { browser } from 'wxt/browser'
import type { Dataset } from '../generators/dataset'
import type { FieldRule, Template } from '../model/types'
import { getOrCreateDataset, reuseDataset } from '../storage/datasetStore'
import { saveQuickRun } from '../storage/quickRunStore'
import { getPrefs, getTemplate, listApps, listTemplates, saveTemplate, setPrefs } from '../storage/repository'
import { matchApp } from './appMatch'
import { clearLastReport, recordFillResult } from './lastReport'
import type { ContentMessage, FillMode, RecordStartResponse, ScanResponse, UndoResponse } from './messages'
import { isProblem } from './reportSummary'
import { chooseShortcutTemplate } from './shortcutTemplate'
import type { FillReport } from './runFill'

const CONTENT_SCRIPT = '/content-scripts/content.js'
export const NO_FIELDS_FOUND = 'Keine Formularfelder auf dieser Seite erkannt.'
/** Id of the ad-hoc template a quick fill runs with; it is never stored. */
export const QUICK_TEMPLATE_ID = 'quick'

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

/** Shared fill path of stored templates and quick fills: dataset, injection, fill message, answer check. */
async function fillWithTemplate(tabId: number, template: Template, mode: FillMode, dataset?: Dataset): Promise<FillReport> {
  dataset ??= await getOrCreateDataset(tabId, template, fakerDE)
  await injectContentScript(tabId)
  const message: ContentMessage = { type: 'fill', template, dataset, mode }
  const report: unknown = await browser.tabs.sendMessage(tabId, message)
  if (!isFillReport(report)) throw new Error('Die Seite hat nicht geantwortet')
  return report
}

async function runDispatch(tabId: number, templateId: string, mode: FillMode): Promise<FillReport> {
  const template = await getTemplate(templateId)
  if (!template) throw new Error('Vorlage nicht gefunden')

  const report = await fillWithTemplate(tabId, template, mode)
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

function isScanResponse(value: unknown): value is ScanResponse {
  if (typeof value !== 'object' || value === null) return false
  const { ok, fields, error } = value as { ok?: unknown; fields?: unknown; error?: unknown }
  return (ok === true && Array.isArray(fields)) || (ok === false && typeof error === 'string')
}

/** Asks the page for the rules the recorder would suggest for all of its form fields. */
export async function scanPage(tabId: number): Promise<FieldRule[]> {
  await injectContentScript(tabId)
  const message: ContentMessage = { type: 'scan' }
  const response: unknown = await browser.tabs.sendMessage(tabId, message)
  if (!isScanResponse(response)) throw new Error('Die Seite hat nicht geantwortet')
  if (!response.ok) throw new Error(response.error)
  return response.fields
}

/**
 * Fills the page without a stored template: scans it, fills with an ad-hoc template and keeps the
 * run per tab so the popup can offer to save it. Touches neither templates nor lastTemplateId;
 * failures land in the tab's report and badge like any other run.
 */
export async function quickFill(tabId: number, mode: FillMode, page: { url: string; title: string }): Promise<FillReport> {
  let report: FillReport
  try {
    report = await runQuickFill(tabId, mode, page)
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await remember(tabId, { templateId: QUICK_TEMPLATE_ID, filled: 0, total: 0, fields: [], error })
    throw e
  }
  await remember(tabId, report)
  return report
}

/** Fields that only appear after a value was set (a billing address behind a checkbox) get up to this many extra passes. */
const EXTRA_PASSES = 2

function quickTemplate(fields: FieldRule[]): Template {
  return { id: QUICK_TEMPLATE_ID, appId: '', name: 'Schnellfüllen', process: null, fields, lastMissing: [] }
}

function mergeReports(first: FillReport, more: FillReport): FillReport {
  return { ...first, filled: first.filled + more.filled, total: first.total + more.total, fields: [...first.fields, ...more.fields] }
}

async function runQuickFill(tabId: number, mode: FillMode, page: { url: string; title: string }): Promise<FillReport> {
  let fields = await scanPage(tabId)
  if (fields.length === 0) throw new Error(NO_FIELDS_FOUND)
  const dataset = await getOrCreateDataset(tabId, quickTemplate(fields), fakerDE)
  let report = await fillWithTemplate(tabId, quickTemplate(fields), mode, dataset)
  const seen = new Set(fields.map((f) => JSON.stringify(f.locator)))
  for (let pass = 0; pass < EXTRA_PASSES && report.error === undefined; pass++) {
    const added = (await scanPage(tabId)).filter((f) => !seen.has(JSON.stringify(f.locator)))
    if (added.length === 0) break
    for (const f of added) seen.add(JSON.stringify(f.locator))
    fields = [...fields, ...added]
    // Same dataset as the first pass, extended by the slots the new fields need (e.g. address B).
    const extended = await reuseDataset(tabId, quickTemplate(fields), fakerDE)
    report = mergeReports(report, await fillWithTemplate(tabId, quickTemplate(added), mode, extended))
  }
  const problems = report.fields.filter((f) => isProblem(f.status)).map((f) => f.fieldId)
  await saveQuickRun(tabId, { fields, problems, url: page.url, title: page.title })
  return report
}

function isUndoResponse(value: unknown): value is UndoResponse {
  if (typeof value !== 'object' || value === null) return false
  const { ok, restored, kept, error } = value as { ok?: unknown; restored?: unknown; kept?: unknown; error?: unknown }
  return (ok === true && typeof restored === 'number' && Array.isArray(kept)) || (ok === false && typeof error === 'string')
}

/**
 * Puts the last run on the tab back. The tab's report and badge go either way: after a successful
 * undo they are obsolete, and when the page has nothing to undo they describe a page that is gone.
 */
export async function undoLastRun(tabId: number): Promise<UndoResponse> {
  await injectContentScript(tabId)
  const message: ContentMessage = { type: 'undo' }
  const response: unknown = await browser.tabs.sendMessage(tabId, message)
  if (!isUndoResponse(response)) throw new Error('Die Seite hat nicht geantwortet')
  await clearLastReport(tabId)
  return response
}

export async function startRecording(tabId: number, templateId: string): Promise<void> {
  await injectContentScript(tabId)
  const message: ContentMessage = { type: 'record:start', templateId }
  const response: unknown = await browser.tabs.sendMessage(tabId, message)
  if (!isRecordStartResponse(response)) throw new Error('Die Seite hat nicht geantwortet')
  if (!response.ok) throw new Error(response.error)
}

/**
 * Keyboard shortcut. On a page of a known app it fills the template that fits (see
 * `chooseShortcutTemplate`). Everywhere else, and for an app without templates, it fills the page
 * without a template (quick fill): templates belong to apps, so a page no app matches is not a
 * page of any template.
 */
export async function fillByShortcut(): Promise<FillReport | null> {
  const { mode, lastTemplateId } = await getPrefs()
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id === undefined) return null
  const app = tab.url === undefined ? null : matchApp(tab.url, await listApps())
  const last = lastTemplateId === null ? null : ((await getTemplate(lastTemplateId)) ?? null)
  const chosen = app === null ? null : chooseShortcutTemplate(await listTemplates(app.id), last)
  if (chosen === null) return quickFill(tab.id, mode, { url: tab.url ?? '', title: tab.title ?? '' })
  return dispatchFill(tab.id, chosen.id, mode)
}
