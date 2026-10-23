/* Browser test (`npm run test:e2e`): expects `.output/chrome-mv3-e2e` from `wxt build --mode e2e`
   and starts the local test site; a test site already running on the port is reused. */
import path from 'node:path'
import { defineConfig } from 'playwright/test'
import { ROOT, SITE_URL } from './fixtures'

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  // One browser with the extension at a time; the tests share the extension's storage otherwise.
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  outputDir: path.join(ROOT, '.output/e2e-results'),
  webServer: {
    command: `npm run test-site -- --port ${new URL(SITE_URL).port} --strictPort`,
    cwd: ROOT,
    url: SITE_URL,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
