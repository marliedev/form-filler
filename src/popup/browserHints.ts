/** Where the user changes extension shortcuts; resolved at build time per browser target. */
export const SHORTCUTS_PAGE_HINT: string =
  import.meta.env.BROWSER === 'firefox'
    ? 'unter about:addons → Zahnrad → „Tastenkürzel für Erweiterungen verwalten“'
    : 'unter chrome://extensions/shortcuts'
