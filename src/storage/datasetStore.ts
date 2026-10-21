import type { Faker } from '@faker-js/faker'
import { browser } from 'wxt/browser'
import { createDataset, ensureSlots, type Dataset } from '../generators/dataset'
import type { Template } from '../model/types'

const tabPrefix = (tabId: number): string => `ds:${tabId}:`

function keyFor(tabId: number, t: Template): string {
  return `${tabPrefix(tabId)}${t.process?.name ?? t.id}`
}

/**
 * Step 1 of a process (and any template without a process) starts a new dataset;
 * later steps reuse the tab's dataset. Session storage keeps it until the browser restarts.
 */
export async function getOrCreateDataset(tabId: number, t: Template, f: Faker): Promise<Dataset> {
  const key = keyFor(tabId, t)
  const startsNew = t.process === null || t.process.step <= 1
  const stored = startsNew ? undefined : ((await browser.storage.session.get(key))[key] as Dataset | undefined)
  const dataset = ensureSlots(stored ?? createDataset(f), t, f)
  await browser.storage.session.set({ [key]: dataset })
  return dataset
}

export async function clearDatasetsForTab(tabId: number): Promise<void> {
  const prefix = tabPrefix(tabId)
  const keys = Object.keys(await browser.storage.session.get(null)).filter((key) => key.startsWith(prefix))
  if (keys.length > 0) await browser.storage.session.remove(keys)
}
