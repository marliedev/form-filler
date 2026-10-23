import type { Page } from 'playwright/test'
import { expect, test } from './fixtures'

interface Model {
  company: string
  customerNo: string
  birthDate: string
  industry: string
  role: string
  country: string
  billingDiffers: boolean
  address: { zip: string }
}

async function model(page: Page): Promise<Model> {
  return JSON.parse(await page.getByTestId('model').innerText()) as Model
}

test.describe('Schnellfüllen', () => {
  test('füllt die Testseite ohne App und Vorlage', async ({ extension }) => {
    await extension.seed([], [])
    const { page, tabId } = await extension.open()

    const report = await extension.quickFill(tabId)

    expect(report.error).toBeUndefined()
    // Thirteen main-document fields are visible before the billing checkbox is ticked, plus two
    // web components and the three fields of the delivery frame.
    expect(report.fields.filter((f) => f.status !== 'filled')).toEqual([])
    expect(report.filled).toBe(18)
    const m = await model(page)
    expect(m.company).not.toBe('')
    expect(m.customerNo).toMatch(/^TEST-\d{6}$/)
    expect(m.birthDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
    expect(['Teilnehmer', 'Lernmanager', 'Admin']).toContain(m.role)
    expect(m.country).toBe('de')
    expect(m.address.zip).toMatch(/^\d{5}$/)
    expect(m.billingDiffers).toBe(true)
    expect(['it', 'handel', 'bau']).toContain(m.industry)
    expect(await extension.badge(tabId)).toBe('✓')
    const run = (await extension.session())[`quick:${tabId}`] as { fields: unknown[]; problems: string[]; url: string; title: string }
    expect(run.fields).toHaveLength(18)
    expect(run.problems).toEqual([])
    expect(run.title).toBe('Musterformular')
  })
})
