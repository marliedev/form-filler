import bricolage from './fonts/bricolage-grotesque.woff2?inline'
import wotfardLight from './fonts/wotfard-light.woff2?inline'
import wotfardMedium from './fonts/wotfard-medium.woff2?inline'

declare global {
  interface Window {
    __formFillerFonts?: boolean
  }
}

/** Prefixed so the faces can never clash with fonts of the host page. */
export const OVERLAY_FONT_BODY = 'FF Wotfard'
export const OVERLAY_FONT_DISPLAY = 'FF Bricolage'

const FACES: { family: string; source: string; weight: string }[] = [
  { family: OVERLAY_FONT_BODY, source: wotfardLight, weight: '300' },
  { family: OVERLAY_FONT_BODY, source: wotfardMedium, weight: '500' },
  { family: OVERLAY_FONT_DISPLAY, source: bricolage, weight: '600 800' },
]

function toBuffer(dataUrl: string): ArrayBuffer {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/**
 * Chrome ignores @font-face inside a shadow root, so the overlay's faces are registered on the
 * page document. Binary sources need no fetch: neither web_accessible_resources nor the page's
 * font-src CSP get involved. Runs once per page; the faces stay registered after the overlay closes.
 */
export function registerOverlayFonts(doc: Document): void {
  const view = doc.defaultView
  if (!view || view.__formFillerFonts) return
  if (typeof FontFace === 'undefined' || !('fonts' in doc)) return
  view.__formFillerFonts = true
  for (const { family, source, weight } of FACES) {
    try {
      const face = new FontFace(family, toBuffer(source), { weight, style: 'normal', display: 'swap' })
      doc.fonts.add(face)
      // A broken face only means the fallback font is used; never an unhandled rejection.
      face.loaded.catch(() => undefined)
    } catch {
      // Same: the overlay stays usable with the fallback font.
    }
  }
}
