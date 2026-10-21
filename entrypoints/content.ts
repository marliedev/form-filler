import { fakerDE } from '@faker-js/faker'
import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { handleFillMessage } from '../src/fill/handleFillMessage'

declare global {
  interface Window {
    __formFillerLoaded?: boolean
  }
}

export default defineContentScript({
  // No `matches`: WXT would add them to the mandatory host_permissions. Access comes from
  // activeTab (popup click, shortcut) or the optional host permission instead.
  registration: 'runtime',
  main() {
    // The extension injects this script before every message; listen only once per page.
    if (window.__formFillerLoaded) return
    window.__formFillerLoaded = true

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: unknown) => void) => {
      if (typeof message !== 'object' || message === null || (message as { type?: unknown }).type !== 'fill') return
      void handleFillMessage(message, document, fakerDE).then(sendResponse)
      // Keeps the channel open for the async response.
      return true
    })
  },
})
