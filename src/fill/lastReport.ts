import { browser } from 'wxt/browser'
import { problemCount } from './reportSummary'
import type { FillReport } from './runFill'

export const reportKey = (tabId: number): string => `report:${tabId}`

// Contrast >= 4.5:1 against the white badge text.
const BADGE_OK = '#15803d'
const BADGE_PROBLEM = '#b91c1c'

/**
 * Keeps the last result per tab (session storage, so the popup can show it later)
 * and mirrors it on the toolbar badge — shortcut runs would otherwise be invisible.
 */
export async function recordFillResult(tabId: number, report: FillReport): Promise<void> {
  const problems = problemCount(report)
  const text = report.error !== undefined ? '!' : problems === 0 ? '✓' : String(problems)
  await browser.storage.session.set({ [reportKey(tabId)]: report })
  await browser.action.setBadgeBackgroundColor({ tabId, color: problems === 0 ? BADGE_OK : BADGE_PROBLEM })
  await browser.action.setBadgeText({ tabId, text })
}

export async function getLastReport(tabId: number): Promise<FillReport | null> {
  const key = reportKey(tabId)
  return ((await browser.storage.session.get(key))[key] as FillReport | undefined) ?? null
}

/** Forgets the tab's last report (e.g. after undo) and clears its badge. */
export async function clearLastReport(tabId: number): Promise<void> {
  await browser.storage.session.remove(reportKey(tabId))
  await clearBadge(tabId)
}

export async function clearBadge(tabId: number): Promise<void> {
  await browser.action.setBadgeText({ tabId, text: '' })
}
