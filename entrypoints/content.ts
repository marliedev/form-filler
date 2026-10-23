import { fakerDE } from '@faker-js/faker'
import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { scanControls } from '../src/dom/scan'
import { handleFillMessage } from '../src/fill/handleFillMessage'
import type { ScanResponse } from '../src/fill/messages'
import { startRecorder } from '../src/recorder/mountRecorder'

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
      if (typeof message !== 'object' || message === null) return
      const { type, templateId } = message as { type?: unknown; templateId?: unknown }
      if (type === 'fill') {
        void handleFillMessage(message, document, fakerDE).then(sendResponse)
      } else if (type === 'record:start' && typeof templateId === 'string') {
        void startRecorder(templateId).then(sendResponse)
      } else if (type === 'scan') {
        let response: ScanResponse
        try {
          response = { ok: true, fields: scanControls(document) }
        } catch (e) {
          response = { ok: false, error: e instanceof Error ? e.message : String(e) }
        }
        sendResponse(response)
        return
      } else {
        return
      }
      // Keeps the channel open for the async response.
      return true
    })
  },
})
