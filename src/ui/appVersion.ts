import { browser } from 'wxt/browser'

/** Version of the installed build; WXT copies it from package.json into the manifest. */
export function appVersion(): string {
  return browser.runtime.getManifest().version
}
