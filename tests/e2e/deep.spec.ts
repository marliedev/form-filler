import type { Page } from 'playwright/test'
import type { Template } from '../../src/model/types'
import { expect, test } from './fixtures'
import { APP, DEEP, EMPTY } from './site'

interface Model {
  costCenter: string
  poNumber: string
  address: { zip: string }
  delivery: { street: string; zip: string; city: string; carrier: string }
}

async function model(page: Page): Promise<Model> {
  return JSON.parse(await page.getByTestId('model').innerText()) as Model
}

test.describe('Komponenten und Rahmen', () => {
  test('füllt Felder in Web-Components und im Rahmen und hält Haupt- und Rahmen-PLZ auseinander', async ({ extension }) => {
    await extension.seed([APP], [DEEP])
    const { page, tabId } = await extension.open()

    const report = await extension.fill(tabId, DEEP.id)

    expect(report.fields.filter((f) => f.status !== 'filled')).toEqual([])
    const m = await model(page)
    expect(m.costCenter).toMatch(/^KST-\d{4}$/)
    expect(m.poNumber).toMatch(/^PO-\d{5}$/)
    expect(m.delivery.street).not.toBe('')
    expect(m.delivery.zip).toMatch(/^\d{5}$/)
    expect(m.delivery.carrier).toBe('dpd')
    expect(m.address.zip).toMatch(/^\d{5}$/)
    // Slots A and B come from different addresses; equal zips are practically impossible among 8,000.
    expect(m.delivery.zip).not.toBe(m.address.zip)
  })

  test('nimmt Felder in Komponente und Rahmen zurück, auch die Auswahlliste im Rahmen', async ({ extension }) => {
    await extension.seed([APP], [DEEP])
    const { page, tabId } = await extension.open()
    await extension.fill(tabId, DEEP.id)

    expect(await extension.undo(tabId)).toEqual({ ok: true, restored: DEEP.fields.length, kept: [] })
    const m = await model(page)
    expect(m.costCenter).toBe('')
    expect(m.poNumber).toBe('')
    expect(m.delivery).toEqual({ street: '', zip: '', city: '', carrier: '' })
    expect(m.address.zip).toBe('')
  })

  test('nimmt Felder in Komponente und Rahmen per Klick auf', async ({ extension }) => {
    await extension.seed([APP], [EMPTY])
    const { page, tabId } = await extension.open()
    await extension.record(tabId, EMPTY.id)

    await page.locator('wc-input input').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen' }).click()
    await page.frameLocator('iframe[name="delivery"]').locator('#zip').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen' }).click()
    await expect(page.getByTestId('captured-box')).toHaveCount(2)
    await page.getByRole('region', { name: 'Aufnahme' }).getByRole('button', { name: 'Speichern' }).click()

    const saved = ((await extension.local()).templates as Template[]).find((t) => t.id === EMPTY.id)
    expect(saved?.fields.map((f) => [f.locator.name, f.locator.scope])).toEqual([
      ['po_number', ['wc-input#po-number']],
      ['zip', ['iframe:delivery']],
    ])
    expect(saved?.fields[0]?.label).toBe('Bestellnummer')
  })
})
