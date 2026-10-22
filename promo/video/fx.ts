/* Animation building blocks shared by all scenes. */

/** Font specs the stage uses; loaded up front so the first captured frame never shows a fallback. */
export const FONT_SPECS = [
  '600 16px "Bricolage Grotesque"',
  '700 16px "Bricolage Grotesque"',
  '800 16px "Bricolage Grotesque"',
  '300 16px Wotfard',
  '500 16px Wotfard',
] as const

/**
 * Fonts load lazily on first use, so a frame captured right after mount could still show the
 * fallback. Requesting the faces explicitly starts their loads; `ready` then waits for them.
 */
export async function fontsReady(doc: Document): Promise<void> {
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts) return
  // A missing face (Wotfard without the local files) rejects; the fallback font is acceptable.
  await Promise.all(FONT_SPECS.map((spec) => fonts.load(spec).catch(() => []))).catch(() => undefined)
  await fonts.ready
}
