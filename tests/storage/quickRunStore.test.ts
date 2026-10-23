import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { clearQuickRun, getQuickRun, saveQuickRun, type QuickRun } from '../../src/storage/quickRunStore'

const run: QuickRun = { fields: [], problems: ['b'], url: 'https://x.example.com/a', title: 'Seite' }

beforeEach(() => {
  fakeBrowser.reset()
})

describe('quickRunStore', () => {
  it('keeps one run per tab in session storage and clears it', async () => {
    await saveQuickRun(7, run)
    expect(await getQuickRun(7)).toEqual(run)
    expect(await getQuickRun(8)).toBeNull()
    expect(Object.keys(await fakeBrowser.storage.session.get(null))).toEqual(['quick:7'])
    await clearQuickRun(7)
    expect(await getQuickRun(7)).toBeNull()
  })

  it('a second run replaces the first', async () => {
    await saveQuickRun(7, run)
    await saveQuickRun(7, { ...run, title: 'Andere Seite' })
    expect((await getQuickRun(7))?.title).toBe('Andere Seite')
  })
})
