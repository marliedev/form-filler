import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { fillLastUsed } from '../src/fill/dispatch'
import { clearDatasetsForTab } from '../src/storage/datasetStore'

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command) => {
    if (command !== 'fill-last') return
    fillLastUsed().catch((e: unknown) => console.warn('Form Filler: Befüllen per Tastenkürzel fehlgeschlagen', e))
  })

  browser.tabs.onRemoved.addListener((tabId) => {
    void clearDatasetsForTab(tabId)
  })
})
