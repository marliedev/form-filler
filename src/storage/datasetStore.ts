import type { Faker } from '@faker-js/faker'
import { browser } from 'wxt/browser'
import { reportKey } from '../fill/lastReport'
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

/** The tab's existing dataset for this template, extended by the slots the template needs; throws when the run has not started. */
export async function reuseDataset(tabId: number, t: Template, f: Faker): Promise<Dataset> {
  const key = keyFor(tabId, t)
  const stored = (await browser.storage.session.get(key))[key] as Dataset | undefined
  if (!stored) throw new Error('Kein Datensatz für diesen Lauf vorhanden')
  const dataset = ensureSlots(stored, t, f)
  await browser.storage.session.set({ [key]: dataset })
  return dataset
}

/** The dataset created last in the tab (a tab can hold one per process); null before the first fill. */
export async function getLatestDataset(tabId: number): Promise<Dataset | null> {
  const prefix = tabPrefix(tabId)
  const stored = await browser.storage.session.get(null)
  const datasets = Object.entries(stored)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => value as Dataset)
  return datasets.reduce<Dataset | null>((latest, ds) => (latest === null || ds.createdAt > latest.createdAt ? ds : latest), null)
}

/** Also drops the tab's last fill report, which belongs to the discarded dataset. */
export async function clearDatasetsForTab(tabId: number): Promise<void> {
  const prefix = tabPrefix(tabId)
  const report = reportKey(tabId)
  const keys = Object.keys(await browser.storage.session.get(null)).filter((key) => key.startsWith(prefix) || key === report)
  if (keys.length > 0) await browser.storage.session.remove(keys)
}
