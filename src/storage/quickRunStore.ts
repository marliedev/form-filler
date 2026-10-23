import { browser } from 'wxt/browser'
import type { FieldRule } from '../model/types'

/** What a quick fill recognized on a page, kept so the popup can offer to save it as a template. */
export interface QuickRun {
  fields: FieldRule[]
  /** Ids of fields the run could not fill (missing, ambiguous, failed). */
  problems: string[]
  /** Page the run happened on; the offer to save only applies there. */
  url: string
  title: string
}

const keyFor = (tabId: number): string => `quick:${tabId}`

/** Session storage: one run per tab, replaced by the next run, gone with the browser session. */
export async function saveQuickRun(tabId: number, run: QuickRun): Promise<void> {
  await browser.storage.session.set({ [keyFor(tabId)]: run })
}

export async function getQuickRun(tabId: number): Promise<QuickRun | null> {
  const key = keyFor(tabId)
  return ((await browser.storage.session.get(key))[key] as QuickRun | undefined) ?? null
}

export async function clearQuickRun(tabId: number): Promise<void> {
  await browser.storage.session.remove(keyFor(tabId))
}
