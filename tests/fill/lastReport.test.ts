import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { getLastReport, recordFillResult } from '../../src/fill/lastReport'
import type { FillReport } from '../../src/fill/runFill'
import { clearDatasetsForTab } from '../../src/storage/datasetStore'

const complete: FillReport = { templateId: 't', filled: 1, total: 1, fields: [{ fieldId: 'a', label: 'A', status: 'filled' }] }
const partial: FillReport = {
  templateId: 't',
  filled: 1,
  total: 3,
  fields: [
    { fieldId: 'a', label: 'A', status: 'filled' },
    { fieldId: 'b', label: 'B', status: 'missing' },
    { fieldId: 'c', label: 'C', status: 'failed' },
  ],
}

beforeEach(() => {
  fakeBrowser.reset()
})

describe('recordFillResult', () => {
  it('stores the report per tab in session storage', async () => {
    await recordFillResult(3, partial)
    expect(await getLastReport(3)).toEqual(partial)
    expect(await getLastReport(4)).toBeNull()
    expect(await fakeBrowser.storage.session.get('report:3')).toEqual({ 'report:3': partial })
  })

  it('shows a check mark badge when everything was filled', async () => {
    await recordFillResult(3, complete)
    expect(await fakeBrowser.action.getBadgeText({ tabId: 3 })).toBe('✓')
  })

  it('shows the problem count on a red badge otherwise', async () => {
    await recordFillResult(3, partial)
    expect(await fakeBrowser.action.getBadgeText({ tabId: 3 })).toBe('2')
    expect(await fakeBrowser.action.getBadgeBackgroundColor({ tabId: 3 })).toEqual([185, 28, 28, 255])
  })

  it('shows "!" for a run error', async () => {
    await recordFillResult(3, { templateId: 't', filled: 0, total: 0, fields: [], error: 'kaputt' })
    expect(await fakeBrowser.action.getBadgeText({ tabId: 3 })).toBe('!')
  })

  it('is cleared together with the datasets of the tab', async () => {
    await recordFillResult(3, partial)
    await recordFillResult(4, partial)
    await clearDatasetsForTab(3)
    expect(await getLastReport(3)).toBeNull()
    expect(await getLastReport(4)).toEqual(partial)
  })
})
