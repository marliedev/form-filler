import { gsap } from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'
import { CAPTIONS, type CaptionKey } from './data'

gsap.registerPlugin(TextPlugin)
import type { Point } from './geometry'

/* Animation building blocks shared by all scenes. Every helper inserts at an absolute time `at`
   and returns the time it ends, so scenes can chain them without bookkeeping. */

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

export const EASE = { appear: 'power2.out', move: 'power2.inOut', pop: 'back.out(1.4)', caption: 'power3.out' } as const

type Timeline = gsap.core.Timeline

export function el(root: HTMLElement, name: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(`[data-el=${name}]`)
  if (!found) throw new Error(`stage element missing: ${name}`)
  return found
}

/* ---- cursor ---------------------------------------------------------------------------- */

/** Hotspot of the arrow inside the 28x40 cursor SVG. */
const TIP = { x: 3, y: 2 }
const lastTarget = new WeakMap<HTMLElement, Point>()

export function cursorShow(tl: Timeline, root: HTMLElement, at: number, visible: boolean): number {
  tl.to(el(root, 'cursor'), { opacity: visible ? 1 : 0, duration: 0.2 }, at)
  return at + 0.2
}

/** Places the cursor tip at (x, y) without motion; use before the cursor becomes visible. */
export function cursorJump(tl: Timeline, root: HTMLElement, p: Point, at: number): number {
  tl.set(el(root, 'cursor'), { left: p.x - TIP.x, top: p.y - TIP.y }, at)
  lastTarget.set(root, p)
  return at
}

export function cursorTo(tl: Timeline, root: HTMLElement, p: Point, at: number, duration = 0.45): number {
  tl.to(el(root, 'cursor'), { left: p.x - TIP.x, top: p.y - TIP.y, duration, ease: EASE.move }, at)
  lastTarget.set(root, p)
  return at + duration
}

/** Press feedback on the arrow plus a ring that widens from the tip and fades. */
export function click(tl: Timeline, root: HTMLElement, at: number): number {
  const p = lastTarget.get(root) ?? { x: 0, y: 0 }
  tl.to(el(root, 'cursor'), { scale: 0.9, duration: 0.08, yoyo: true, repeat: 1 }, at)
  tl.fromTo(el(root, 'ripple'), { left: p.x - 28, top: p.y - 28, scale: 0.3, opacity: 0.6 }, { immediateRender: false, scale: 1.2, opacity: 0, duration: 0.3, ease: EASE.appear }, at)
  return at + 0.3
}

/* ---- text ------------------------------------------------------------------------------ */

/**
 * Types (`to`) or deletes (`to === ''`) character by character with GSAP's TextPlugin, which
 * restores every intermediate state on backward seeks; `onUpdate`-driven text would not.
 * `from` is the text already in the element at `at`; deleting runs right-to-left like Backspace.
 */
export function typeText(tl: Timeline, target: HTMLElement, from: string, to: string, at: number, msPerChar: number): number {
  const chars = to === '' ? from.length : to.length
  const duration = Math.max(chars * msPerChar / 1000, 0.001)
  tl.to(target, { text: { value: to, rtl: to === '' }, duration, ease: 'none' }, at)
  return at + duration
}

/** Sets text at `at`; via TextPlugin so a backward seek restores the previous text verbatim. */
export function setText(tl: Timeline, target: HTMLElement, value: string, at: number): void {
  tl.set(target, { text: { value } }, at)
}

/** Blinking text cursor next to a value span, for the human typing in scene 1 only. */
export function caret(tl: Timeline, caretEl: HTMLElement, at: number, until: number): void {
  const blinks = Math.max(1, Math.round((until - at) / 0.5))
  tl.fromTo(caretEl, { opacity: 1 }, { immediateRender: false, opacity: 0, duration: 0.5, ease: 'steps(1)', repeat: blinks - 1, yoyo: true }, at)
  tl.set(caretEl, { opacity: 0 }, until)
}

/* ---- captions, camera, effects --------------------------------------------------------- */

export function caption(tl: Timeline, root: HTMLElement, key: CaptionKey, at: number, hold: number): number {
  const c: { title: string; sub?: string } = CAPTIONS[key]
  const box = el(root, 'captions')
  setText(tl, el(root, 'caption-title'), c.title, at)
  setText(tl, el(root, 'caption-sub'), c.sub ?? '', at)
  tl.fromTo(box, { y: 24, opacity: 0 }, { immediateRender: false, y: 0, opacity: 1, duration: 0.4, ease: EASE.caption }, at)
  tl.to(box, { opacity: 0, duration: 0.25 }, at + hold)
  return at + hold + 0.25
}

/** Scales the window layer around a stage point; captions, cursor and keys stay unscaled. */
export function zoom(tl: Timeline, root: HTMLElement, focus: Point & { scale: number }, at: number, duration = 0.7): number {
  const layer = el(root, 'window')
  tl.set(layer, { transformOrigin: `${focus.x}px ${focus.y}px` }, at)
  tl.to(layer, { scale: focus.scale, duration, ease: EASE.move }, at)
  return at + duration
}

/** Teal pulse on a form field: 0 → 1 → 0 in 500 ms. */
export function glow(tl: Timeline, target: HTMLElement, at: number): number {
  tl.fromTo(target, { boxShadow: '0 0 0 0px rgba(20,184,184,0)' }, { immediateRender: false, boxShadow: '0 0 0 4px rgba(20,184,184,0.55)', duration: 0.25, ease: EASE.appear }, at)
  tl.to(target, { boxShadow: '0 0 0 0px rgba(20,184,184,0)', duration: 0.25 }, at + 0.25)
  return at + 0.5
}

/** A band of light crossing the browser window from left to right. */
export function sweep(tl: Timeline, root: HTMLElement, at: number): number {
  const band = el(root, 'sweep')
  tl.fromTo(band, { left: -300, opacity: 1 }, { immediateRender: false, left: 1600, duration: 0.9, ease: EASE.move }, at)
  tl.set(band, { opacity: 0 }, at + 0.9)
  return at + 0.9
}

export function fade(tl: Timeline, target: HTMLElement, at: number, opacity: number, duration = 0.3): number {
  tl.to(target, { opacity, duration }, at)
  return at + duration
}

export function show(tl: Timeline, target: HTMLElement, at: number, display: string): void {
  tl.set(target, { display }, at)
}
