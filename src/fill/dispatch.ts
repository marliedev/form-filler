import { fakerDE } from '@faker-js/faker'
import { browser } from 'wxt/browser'
import { getOrCreateDataset } from '../storage/datasetStore'
import { getPrefs, getTemplate, saveTemplate, setPrefs } from '../storage/repository'
import { recordFillResult } from './lastReport'
import type { ContentMessage, FillMode } from './messages'
import type { FillReport } from './runFill'

const CONTENT_SCRIPT = '/content-scripts/content.js'
const PROBLEM_STATUSES = new Set(['missing', 'ambiguous', 'failed'])

/** The content script guards itself against double registration, so injecting on every call is safe. */
async function injectContentScript(tabId: number): Promise<void> {
  await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] })
}

function isFillReport(value: unknown): value is FillReport {
  return typeof value === 'object' && value !== null && Array.isArray((value as FillReport).fields)
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
  if (report.error === undefined) {
    const lastMissing = report.fields.filter((f) => PROBLEM_STATUSES.has(f.status)).map((f) => f.fieldId)
    await saveTemplate({ ...template, lastMissing })
  }
  return report
}

export async function startRecording(tabId: number, templateId: string): Promise<void> {
  await injectContentScript(tabId)
  const message: ContentMessage = { type: 'record:start', templateId }
  await browser.tabs.sendMessage(tabId, message)
}

/** Keyboard shortcut: refill the active tab with the last used template; no-op if there is none (anymore). */
export async function fillLastUsed(): Promise<FillReport | null> {
  const { mode, lastTemplateId } = await getPrefs()
  if (lastTemplateId === null || !(await getTemplate(lastTemplateId))) return null
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (tab?.id === undefined) return null
  return dispatchFill(tab.id, lastTemplateId, mode)
}
