import { fakerDE } from '@faker-js/faker'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { FieldRule, Template } from '../../src/model/types'
import { clearDatasetsForTab, getOrCreateDataset } from '../../src/storage/datasetStore'

const rule = (id: string, slot: string | null): FieldRule => ({
  id, label: id, locator: { kind: 'text', name: id }, config: { type: 'firstName' }, slot, required: false, appendRunId: false,
})

const template = (id: string, process: Template['process'], fields: FieldRule[] = []): Template => ({
  id, appId: 'app', name: id, process, fields, lastMissing: [],
})

const step1 = template('s1', { name: 'Kundenanlage', step: 1 })
const step2 = template('s2', { name: 'Kundenanlage', step: 2 })

beforeEach(() => {
  fakeBrowser.reset()
})

describe('getOrCreateDataset', () => {
  it('reuses the dataset of step 1 for step 2 in the same tab', async () => {
    const first = await getOrCreateDataset(1, step1, fakerDE)
    const second = await getOrCreateDataset(1, step2, fakerDE)
    expect(second.runId).toBe(first.runId)
    expect(second.company).toEqual(first.company)
  })

  it('keeps datasets separate per tab', async () => {
    fakerDE.seed(1)
    const a = await getOrCreateDataset(1, step1, fakerDE)
    fakerDE.seed(2)
    const b = await getOrCreateDataset(2, step2, fakerDE)
    expect(b.runId).not.toBe(a.runId)
  })

  it('always creates a new dataset for step 1', async () => {
    fakerDE.seed(1)
    const a = await getOrCreateDataset(1, step1, fakerDE)
    fakerDE.seed(2)
    const b = await getOrCreateDataset(1, step1, fakerDE)
    expect(b.runId).not.toBe(a.runId)
    fakerDE.seed(3)
    const c = await getOrCreateDataset(1, step2, fakerDE)
    expect(c.runId).toBe(b.runId)
  })

  it('always creates a new dataset for templates without a process', async () => {
    const single = template('single', null)
    fakerDE.seed(1)
    const a = await getOrCreateDataset(1, single, fakerDE)
    fakerDE.seed(2)
    const b = await getOrCreateDataset(1, single, fakerDE)
    expect(b.runId).not.toBe(a.runId)
  })

  it('applies ensureSlots and persists the added slots', async () => {
    await getOrCreateDataset(1, step1, fakerDE)
    const withSlot = template('s2b', { name: 'Kundenanlage', step: 2 }, [rule('f', '2')])
    const ds = await getOrCreateDataset(1, withSlot, fakerDE)
    expect(ds.persons['2']).toBeDefined()
    const again = await getOrCreateDataset(1, step2, fakerDE)
    expect(again.persons['2']).toEqual(ds.persons['2'])
  })

  it('stores under ds:<tabId>:<processName> in session storage', async () => {
    const ds = await getOrCreateDataset(7, step1, fakerDE)
    const stored = await fakeBrowser.storage.session.get('ds:7:Kundenanlage')
    expect(stored['ds:7:Kundenanlage']).toEqual(ds)
  })
})

describe('clearDatasetsForTab', () => {
  it('removes only the keys of the given tab', async () => {
    await getOrCreateDataset(1, step1, fakerDE)
    await getOrCreateDataset(11, step1, fakerDE)
    await getOrCreateDataset(2, step1, fakerDE)
    await fakeBrowser.storage.session.set({ other: 1 })
    await clearDatasetsForTab(1)
    const all = await fakeBrowser.storage.session.get(null)
    expect(Object.keys(all).sort()).toEqual(['ds:11:Kundenanlage', 'ds:2:Kundenanlage', 'other'])
  })
})
