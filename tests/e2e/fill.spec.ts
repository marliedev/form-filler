import type { Page } from 'playwright/test'
import type { Dataset } from '../../src/generators/dataset'
import type { Template } from '../../src/model/types'
import { expect, test } from './fixtures'
import { APP, PROCESS, STEP1, STEP2, WITH_MISSING } from './site'

interface Address { street: string; zip: string; city: string }
/** The test site renders its Vue model as JSON, which is what the page actually received. */
interface Model {
  company: string
  customerNo: string
  notes: string
  startDate: string
  birthDate: string
  industry: string
  role: string
  country: string
  topic: string
  billingDiffers: boolean
  address: Address
  billing: Address
  contactFirstName: string
  contactEmail: string
}

async function model(page: Page): Promise<Model> {
  return JSON.parse(await page.getByTestId('model').innerText()) as Model
}

test.describe('Füllen', () => {
  test('befüllt alle Feldarten der Testseite', async ({ extension }) => {
    await extension.seed([APP], [STEP1])
    const { page, tabId } = await extension.open()

    const report = await extension.fill(tabId, STEP1.id)

    expect(report.error).toBeUndefined()
    expect(report.fields.filter((f) => f.status !== 'filled')).toEqual([])
    expect(report.filled).toBe(STEP1.fields.length)
    const m = await model(page)
    expect(m.company).toMatch(/ · T\d{4}$/)
    expect(m.customerNo).toMatch(/^K-\d{4}$/)
    expect(m.notes).not.toBe('')
    expect(m.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(m.birthDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
    expect(['it', 'handel', 'bau']).toContain(m.industry)
    expect(m.role).toBe('Lernmanager')
    expect(m.country).toBe('de')
    expect(m.topic).toBe('Presse')
    expect(m.address.zip).toMatch(/^\d{5}$/)
    expect(m.address.city).not.toBe('')
    expect(m.billingDiffers).toBe(true)
    expect(m.billing.zip).toMatch(/^\d{5}$/)
    expect(await extension.badge(tabId)).toBe('✓')
  })

  test('füllt im Modus „Nur Pflicht“ nur die Pflichtfelder', async ({ extension }) => {
    await extension.seed([APP], [STEP1])
    const { page, tabId } = await extension.open()

    const report = await extension.fill(tabId, STEP1.id, 'required')

    const required = STEP1.fields.filter((f) => f.required).length
    expect(report.filled).toBe(required)
    expect(report.total).toBe(required)
    const m = await model(page)
    expect(m.company).not.toBe('')
    expect(m.address.zip).toMatch(/^\d{5}$/)
    expect(m.notes).toBe('')
    expect(m.industry).toBe('')
    expect(m.billingDiffers).toBe(false)
  })

  test('behält den Datensatz über zwei Prozessschritte', async ({ extension }) => {
    await extension.seed([APP], [STEP1, STEP2])
    const { page, tabId } = await extension.open()
    const datasetKey = `ds:${tabId}:${PROCESS}`

    await extension.fill(tabId, STEP1.id)
    const step1 = await model(page)
    const first = (await extension.session())[datasetKey] as Dataset
    expect(step1.company.endsWith(first.runId)).toBe(true)

    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByRole('heading', { name: 'Schritt 2: Ansprechpartner' })).toBeVisible()
    const report = await extension.fill(tabId, STEP2.id)

    expect(report.filled).toBe(STEP2.fields.length)
    const second = (await extension.session())[datasetKey] as Dataset
    expect(second.runId).toBe(first.runId)
    const step2 = await model(page)
    expect(step2.contactFirstName).toBe(first.persons['1']?.firstName)
    expect(step2.contactEmail).toBe(first.persons['1']?.email)
  })

  test('meldet ein fehlendes Feld im Bericht, im Badge und in der Vorlage', async ({ extension }) => {
    await extension.seed([APP], [WITH_MISSING])
    const { tabId } = await extension.open()

    const report = await extension.fill(tabId, WITH_MISSING.id)

    expect(report.filled).toBe(1)
    expect(report.total).toBe(2)
    expect(report.fields.find((f) => f.fieldId === 'f-phone')?.status).toBe('missing')
    expect(await extension.badge(tabId)).toBe('1')
    const templates = (await extension.local()).templates as Template[]
    expect(templates.find((t) => t.id === WITH_MISSING.id)?.lastMissing).toEqual(['f-phone'])
  })
})
