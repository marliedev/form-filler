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
    // Twelve fields are visible before the billing checkbox is ticked; the "Branche" select gets the
    // industry suggestion, whose text never matches the page's own options.
    expect(report.total).toBe(12)
    expect(report.filled).toBe(11)
    expect(report.fields.filter((f) => f.status !== 'filled').map((f) => [f.label, f.status])).toEqual([['Branche', 'failed']])
    const m = await model(page)
    expect(m.company).not.toBe('')
    expect(m.customerNo).toMatch(/^TEST-\d{6}$/)
    expect(m.birthDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
    expect(['Teilnehmer', 'Lernmanager', 'Admin']).toContain(m.role)
    expect(m.country).toBe('de')
    expect(m.address.zip).toMatch(/^\d{5}$/)
    expect(m.billingDiffers).toBe(true)
    expect(m.industry).toBe('')
    expect(await extension.badge(tabId)).toBe('1')
    const run = (await extension.session())[`quick:${tabId}`] as { fields: unknown[]; problems: string[]; url: string; title: string }
    expect(run.fields).toHaveLength(12)
    expect(run.problems).toHaveLength(1)
    expect(run.title).toBe('Musterformular')
  })
})
