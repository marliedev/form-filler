export interface UserError {
  message: string
  /** Raw technical text, only for errors without a dedicated German message. */
  detail?: string
}

const RESTRICTED = 'Auf dieser Seite können keine Formulare befüllt werden.'
const NO_PERMISSION = 'Keine Berechtigung für diese Seite – App-Adresse prüfen.'
const NO_ANSWER = 'Die Seite hat nicht geantwortet. Bitte die Seite neu laden und erneut versuchen.'

// Order matters: Chrome's restricted-page messages also contain "must request permission".
const RULES: { test: RegExp; message: string }[] = [
  { test: /chrome:\/\/|chrome-extension:\/\/|edge:\/\/|about:|extensions gallery|showing error page|chromewebstore/i, message: RESTRICTED },
  { test: /must request permission|missing host permission|permission to access/i, message: NO_PERMISSION },
  { test: /hat nicht geantwortet|receiving end does not exist|message port closed/i, message: NO_ANSWER },
  { test: /no tab with id/i, message: 'Der Tab ist nicht mehr geöffnet.' },
]

/** German errors produced by the extension itself are shown as they are. */
const OWN_MESSAGES = [/^Vorlage nicht gefunden/, /^Ungültige Vorlage/, /^Auf der Seite läuft noch eine Aufnahme/, /^Noch keine Vorlage genutzt/]

function withPeriod(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`
}

/** Maps raw browser/extension errors to a German message for the popup. */
export function toUserError(e: unknown, fallback = 'Das hat nicht geklappt.'): UserError {
  const raw = (e instanceof Error ? e.message : String(e)).trim()
  const rule = RULES.find((r) => r.test.test(raw))
  if (rule) return { message: rule.message }
  if (OWN_MESSAGES.some((own) => own.test(raw))) return { message: withPeriod(raw) }
  return { message: fallback, detail: raw }
}
