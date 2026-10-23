import type { Template } from '../../src/model/types'
import { expect, test } from './fixtures'
import { APP, EMPTY } from './site'

test.describe('Aufnahme', () => {
  test('nimmt Felder per Klick auf, speichert die Vorlage und kann sie sofort füllen', async ({ extension }) => {
    await extension.seed([APP], [EMPTY])
    const { page, tabId } = await extension.open()

    await extension.record(tabId, EMPTY.id)
    const bar = page.getByRole('region', { name: 'Aufnahme' })
    await expect(bar).toBeVisible()

    // Focusing a page field opens the popover with the suggested data type; "Übernehmen" keeps it.
    await page.locator('#company').click()
    const popover = page.getByRole('dialog')
    await expect(popover).toBeVisible()
    await popover.getByRole('button', { name: 'Übernehmen' }).click()
    await expect(page.getByTestId('captured-box')).toHaveCount(1)

    await page.locator('#zip').click()
    await popover.getByRole('button', { name: 'Übernehmen' }).click()
    await expect(page.getByTestId('captured-box')).toHaveCount(2)

    await bar.getByRole('button', { name: 'Speichern' }).click()
    await expect(bar).toContainText('Vorlage gespeichert')
    const templates = (await extension.local()).templates as Template[]
    const saved = templates.find((t) => t.id === EMPTY.id)
    expect(saved?.fields.map((f) => f.config.type)).toEqual(['companyName', 'zip'])
    expect(saved?.fields.map((f) => f.locator.name)).toEqual(['company', 'zip'])
    expect(saved?.fields[0]?.required).toBe(true)

    const report = await extension.fill(tabId, EMPTY.id)
    expect(report.filled).toBe(2)
    await expect(page.locator('#zip')).toHaveValue(/^\d{5}$/)
  })
})
