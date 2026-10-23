/* Playwright fixtures for the browser test: a Chromium with the e2e build of the extension loaded,
   plus a small API that drives the extension through its service worker. The toolbar button, the
   popup and the shortcut cannot be operated by Playwright, so the test calls the same entry points
   the popup and the shortcut use (exposed by the background only in `--mode e2e`). */
import path from 'node:path'
import { chromium, expect, test as base, type BrowserContext, type Page, type Worker } from 'playwright/test'
import type { WxtBrowser } from 'wxt/browser'
import type { FillMode } from '../../src/fill/messages'
import type { FillReport } from '../../src/fill/runFill'
import type { AppDef, Template } from '../../src/model/types'

export const ROOT = path.resolve(import.meta.dirname, '../..')
export const SITE_URL = 'http://localhost:5179'
const EXTENSION_DIR = path.join(ROOT, '.output/chrome-mv3-e2e')

/** Globals inside the extension's service worker, where the `evaluate` callbacks below run. */
declare const chrome: WxtBrowser
interface E2EApi {
  dispatchFill(tabId: number, templateId: string, mode: FillMode): Promise<FillReport>
  startRecording(tabId: number, templateId: string): Promise<void>
  quickFill(tabId: number, mode: FillMode, page: { url: string; title: string }): Promise<FillReport>
}
type WorkerGlobal = { __formFillerE2E: E2EApi }

export interface Extension {
  worker: Worker
  /** Replaces the stored apps and templates. */
  seed(apps: AppDef[], templates: Template[]): Promise<void>
  /** Opens the test site in a new tab and returns the page with its browser tab id. */
  open(): Promise<{ page: Page; tabId: number }>
  fill(tabId: number, templateId: string, mode?: FillMode): Promise<FillReport>
  record(tabId: number, templateId: string): Promise<void>
  /** Fills without a template, as the popup's "Ohne Vorlage füllen" would on the test site. */
  quickFill(tabId: number, mode?: FillMode): Promise<FillReport>
  badge(tabId: number): Promise<string>
  local(): Promise<Record<string, unknown>>
  session(): Promise<Record<string, unknown>>
}

export const test = base.extend<{ context: BrowserContext; extension: Extension }>({
  context: async ({}, use) => {
    // Extensions need a persistent context; the bundled Chromium runs them headless.
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
    })
    await use(context)
    await context.close()
  },

  extension: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    const extension: Extension = {
      worker,
      seed: (apps, templates) => worker.evaluate((data) => chrome.storage.local.set(data), { apps, templates }),
      async open() {
        const page = await context.newPage()
        await page.goto(SITE_URL)
        const tabId = await worker.evaluate(async (url) => {
          const tabs = await chrome.tabs.query({ url: `${url}/*` })
          const id = tabs[0]?.id
          if (tabs.length !== 1 || id === undefined) throw new Error(`Expected exactly one test-site tab, found ${tabs.length}`)
          return id
        }, SITE_URL)
        return { page, tabId }
      },
      fill: (tabId, templateId, mode = 'all') =>
        worker.evaluate(
          (args) => (globalThis as unknown as WorkerGlobal).__formFillerE2E.dispatchFill(args.tabId, args.templateId, args.mode),
          { tabId, templateId, mode },
        ),
      record: (tabId, templateId) =>
        worker.evaluate(
          (args) => (globalThis as unknown as WorkerGlobal).__formFillerE2E.startRecording(args.tabId, args.templateId),
          { tabId, templateId },
        ),
      quickFill: (tabId, mode = 'all') =>
        worker.evaluate(
          (args) => (globalThis as unknown as WorkerGlobal).__formFillerE2E.quickFill(args.tabId, args.mode, args.page),
          { tabId, mode, page: { url: `${SITE_URL}/`, title: 'Musterformular' } },
        ),
      badge: (tabId) => worker.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId),
      local: () => worker.evaluate(() => chrome.storage.local.get(null)),
      session: () => worker.evaluate(() => chrome.storage.session.get(null)),
    }
    await use(extension)
  },
})

export { expect }
