import type { Page } from 'playwright/test'
import { expect, test } from './fixtures'
import { APP, STEP1 } from './site'

interface Model {
  company: string
  customerNo: string
  industry: string
  role: string
  billingDiffers: boolean
  address: { zip: string }
}

async function model(page: Page): Promise<Model> {
  return JSON.parse(await page.getByTestId('model').innerText()) as Model
}

test.describe('Eigene Werte und Rückgängig', () => {
  test('lässt fremde Eingaben stehen, ersetzt eigene Werte und nimmt den Lauf zurück', async ({ extension }) => {
    await extension.seed([APP], [STEP1])
    const { page, tabId } = await extension.open()
    await page.locator('#customer-no').fill('K-MANUELL')

    const first = await extension.fill(tabId, STEP1.id)
    expect(first.fields.find((f) => f.fieldId === 'f-customer-no')?.status).toBe('kept')
    expect(first.filled).toBe(STEP1.fields.length - 1)
    const m1 = await model(page)
    expect(m1.customerNo).toBe('K-MANUELL')
    expect(m1.company).not.toBe('')

    // A new dataset replaces own values; the manual one stays.
    await extension.newDataset(tabId)
    const second = await extension.fill(tabId, STEP1.id)
    const m2 = await model(page)
    expect(m2.company).not.toBe(m1.company)
    expect(m2.customerNo).toBe('K-MANUELL')
    expect(second.fields.filter((f) => f.status === 'kept').map((f) => f.fieldId)).toEqual(['f-customer-no'])

    // Undo restores the state before the second run; radio and combobox cannot go back to "nothing".
    const undone = await extension.undo(tabId)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(undone.kept).toEqual([])
    const m3 = await model(page)
    expect(m3.company).toBe(m1.company)
    expect(m3.address.zip).toBe(m1.address.zip)
    expect(m3.customerNo).toBe('K-MANUELL')
    expect(await extension.badge(tabId)).toBe('')

    // The restored values are Form Filler's own again: a further run replaces them.
    await extension.newDataset(tabId)
    const third = await extension.fill(tabId, STEP1.id)
    expect(third.fields.filter((f) => f.status === 'kept').map((f) => f.fieldId)).toEqual(['f-customer-no'])
    expect((await model(page)).company).not.toBe(m1.company)
  })

  test('erkennt eigene Werte nach einem Schrittwechsel wieder', async ({ extension }) => {
    await extension.seed([APP], [STEP1])
    const { page, tabId } = await extension.open()
    await extension.fill(tabId, STEP1.id)
    const m1 = await model(page)

    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByRole('heading', { name: 'Schritt 2: Ansprechpartner' })).toBeVisible()
    await page.getByRole('button', { name: 'Zurück' }).click()
    await expect(page.getByRole('heading', { name: 'Schritt 1: Firmendaten' })).toBeVisible()

    await extension.newDataset(tabId)
    const report = await extension.fill(tabId, STEP1.id)
    expect(report.fields.filter((f) => f.status === 'kept')).toEqual([])
    const m2 = await model(page)
    expect(m2.company).not.toBe(m1.company)
  })

  test('nimmt den Lauf nach dem Neuladen der Seite nicht mehr zurück', async ({ extension }) => {
    await extension.seed([APP], [STEP1])
    const { page, tabId } = await extension.open()
    await extension.fill(tabId, STEP1.id)
    await page.reload()
    const undone = await extension.undo(tabId)
    expect(undone).toEqual({ ok: false, error: 'Nichts zum Zurücknehmen – die Seite wurde seit dem letzten Lauf neu geladen.' })
  })
})
