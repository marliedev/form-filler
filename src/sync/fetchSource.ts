import { parseExport } from '../model/schema'
import type { ExportFile } from '../model/types'

/** A sync failure with a message meant for the status line. */
export class SourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceError'
  }
}

const DOWNLOAD_HINT = 'Bei Freigabe-Links die direkte Download-Adresse eintragen.'
export const NOT_EXPORT_FILE = `Die Adresse liefert keine Form-Filler-Export-Datei. ${DOWNLOAD_HINT}`
export const UNREACHABLE = 'Quelle nicht erreichbar.'
/** The browser blocks a fetch alike for DNS failures, missing host permissions and redirects to hosts it may not reach. */
export const BLOCKED = `${UNREACHABLE} ${DOWNLOAD_HINT}`
export const ONLY_HTTP = 'Nur http- und https-Adressen sind erlaubt.'
const TOO_BIG = 'Die Datei der Quelle ist größer als 5 MB.'
const MAX_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 15_000

/** The origin of a source address, or null when it is not an http(s) address. */
export function sourceOrigin(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null
  } catch {
    return null
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

/** Downloads and validates the team's export file; every failure is a SourceError with a user-facing message. */
export async function fetchSource(url: string, fetchImpl: typeof fetch = fetch): Promise<ExportFile> {
  if (sourceOrigin(url) === null) throw new SourceError(ONLY_HTTP)
  let response: Response
  try {
    response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new SourceError(BLOCKED)
  }
  // A share link that redirects elsewhere (login, download host) is not the file itself; a scheme upgrade on the same host is fine.
  if (response.redirected) {
    const target = hostOf(response.url)
    if (target !== null && target !== hostOf(url)) {
      throw new SourceError(`Die Adresse leitet auf ${target} weiter. Bitte die direkte Download-Adresse eintragen.`)
    }
  }
  if (!response.ok) throw new SourceError(UNREACHABLE)
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new SourceError(TOO_BIG)
  let text: string
  try {
    text = await response.text()
  } catch {
    throw new SourceError(UNREACHABLE)
  }
  if (text.length > MAX_BYTES) throw new SourceError(TOO_BIG)
  const parsed = parseExport(text)
  if (!parsed.ok) throw new SourceError(NOT_EXPORT_FILE)
  return parsed.data
}
