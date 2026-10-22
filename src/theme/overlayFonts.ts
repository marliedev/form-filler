import bricolage from './fonts/bricolage-grotesque.woff2?inline'

declare global {
  interface Window {
    __formFillerFonts?: boolean
  }
}

/** Prefixed so the faces can never clash with fonts of the host page. */
export const OVERLAY_FONT_BODY = 'FF Wotfard'
export const OVERLAY_FONT_DISPLAY = 'FF Bricolage'

interface FaceSource {
  source: string
  weight: string
}

// Wotfard may not be redistributed, so it lives in the gitignored fonts/local folder. Without it
// the glob matches nothing and the body text falls back to the system font.
const localModules = import.meta.glob<string>('./fonts/local/wotfard-*.woff2', {
  eager: true,
  query: '?inline',
  import: 'default',
})
const LOCAL_WEIGHTS: Record<string, string> = {
  './fonts/local/wotfard-light.woff2': '300',
  './fonts/local/wotfard-medium.woff2': '500',
}

/** Locally provided body faces; empty in a checkout without fonts/local. */
export function localBodyFaces(modules: Record<string, string> = localModules): FaceSource[] {
  return Object.entries(LOCAL_WEIGHTS).flatMap(([path, weight]) => {
    const source = modules[path]
    return source ? [{ source, weight }] : []
  })
}

function toBuffer(dataUrl: string): ArrayBuffer {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function addFaces(doc: Document, family: string, faces: FaceSource[]): void {
  for (const { source, weight } of faces) {
    try {
      const face = new FontFace(family, toBuffer(source), { weight, style: 'normal', display: 'swap' })
      doc.fonts.add(face)
      // A broken face only means the fallback font is used; never an unhandled rejection.
      face.loaded.catch(() => undefined)
    } catch {
      // Same: the UI stays usable with the fallback font.
    }
  }
}

function canRegister(doc: Document): boolean {
  return typeof FontFace !== 'undefined' && 'fonts' in doc
}

/**
 * Chrome ignores @font-face inside a shadow root, so the overlay's faces are registered on the
 * page document. Binary sources need no fetch: neither web_accessible_resources nor the page's
 * font-src CSP get involved. Runs once per page; the faces stay registered after the overlay closes.
 */
export function registerOverlayFonts(doc: Document, bodyFaces: FaceSource[] = localBodyFaces()): void {
  const view = doc.defaultView
  if (!view || view.__formFillerFonts || !canRegister(doc)) return
  view.__formFillerFonts = true
  addFaces(doc, OVERLAY_FONT_BODY, bodyFaces)
  addFaces(doc, OVERLAY_FONT_DISPLAY, [{ source: bricolage, weight: '600 800' }])
}

/** Extension pages: registers the optional local body font; fonts.css cannot reference a file that may be missing. */
export function registerPageFonts(doc: Document = document, bodyFaces: FaceSource[] = localBodyFaces()): void {
  if (canRegister(doc)) addFaces(doc, 'Wotfard', bodyFaces)
}
