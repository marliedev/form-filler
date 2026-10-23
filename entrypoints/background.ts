import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { dispatchFill, fillLastUsed, startRecording } from '../src/fill/dispatch'
import { clearDatasetsForTab } from '../src/storage/datasetStore'

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command) => {
    if (command !== 'fill-last') return
    fillLastUsed().catch((e: unknown) => console.warn('Form Filler: Befüllen per Tastenkürzel fehlgeschlagen', e))
  })

  browser.tabs.onRemoved.addListener((tabId) => {
    void clearDatasetsForTab(tabId)
  })

  // `wxt build --mode e2e` only: the browser test can neither click the toolbar button nor press
  // the shortcut, so it calls the same entry points directly. Production builds drop this line.
  if (import.meta.env.MODE === 'e2e') Object.assign(self, { __formFillerE2E: { dispatchFill, startRecording } })
})
