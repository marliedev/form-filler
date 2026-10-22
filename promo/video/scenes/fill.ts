import { TEASER_FOCUS } from '../camera'
import { caption, click, cursorJump, cursorShow, cursorTo, EASE, el, fade, fillCascade, setText, show, sweep, zoom } from '../fx'
import { zoomed, type Point } from '../geometry'
import { STATUS_COLORS } from '../stage'
import type { SceneContext } from '../timeline'

export interface FillOptions {
  /** Captions on, or off for a bare demo. */
  caption: boolean
  /** `full` zooms onto the customer number; `teaser` keeps its own, wider framing. */
  camera: 'full' | 'teaser'
}

const BUSY = 'Bitte warten …'
const DONE = 'Kundenanlage: 12 von 12 befüllt'

/** One click fills the form; the status and badge report success; a second click brings new data. */
export function fill({ tl, root, at, geo }: SceneContext, options: FillOptions): void {
  const popup = el(root, 'popup')
  const badge = el(root, 'badge')
  const status = el(root, 'status')
  const statusDot = el(root, 'status-dot')
  const statusText = el(root, 'status-text')

  // The template now exists: the popup lists it instead of the empty-list hint.
  show(tl, el(root, 'popup-noapp'), at, 'none')
  show(tl, el(root, 'popup-app'), at, 'block')
  show(tl, el(root, 'template-row'), at, 'block')
  show(tl, el(root, 'no-templates'), at, 'none')
  show(tl, el(root, 'new-template-form'), at, 'none')
  fade(tl, popup, at, 1, 0.25)

  // Mirrors the real popup: while a run is busy the status row shows "Bitte warten …" with the info dot.
  const busy = (t: number): void => {
    show(tl, status, t, 'flex')
    tl.set(statusDot, { backgroundColor: STATUS_COLORS.info }, t)
    setText(tl, statusText, BUSY, t)
  }
  const done = (t: number): void => {
    tl.set(statusDot, { backgroundColor: STATUS_COLORS.success }, t)
    setText(tl, statusText, DONE, t)
  }

  // The teaser's window layer is already scaled, so cursor targets have to follow the zoom.
  const target = (selector: string): Point =>
    options.camera === 'teaser' ? zoomed(geo.point(selector), TEASER_FOCUS, TEASER_FOCUS.scale) : geo.point(selector)
  cursorJump(tl, root, target('[data-el=toolbar-icon]'), at)
  cursorShow(tl, root, at + 0.1, true)
  cursorTo(tl, root, target('[data-el=fill-button]'), at + 0.6, 0.4)
  click(tl, root, at + 1.0)
  busy(at + 1.05)
  sweep(tl, root, at + 1.1)
  const filled = fillCascade(tl, root, 0, at + 1.2)
  if (options.caption) caption(tl, root, 'fill1', at + 3.4, 2)

  const reported = Math.max(filled, at + 3.6)
  done(reported)
  tl.set(badge, { opacity: 1 }, reported)
  tl.fromTo(badge, { scale: 0.4 }, { immediateRender: false, scale: 1, duration: 0.4, ease: EASE.pop }, reported)

  if (options.camera === 'full') {
    const focus = { ...geo.field('customerNo'), scale: 1.8 }
    zoom(tl, root, focus, at + 4.0)
    zoom(tl, root, { ...focus, scale: 1 }, at + 5.6)
  }

  // Second click only after the zoom-out (5.6–6.3) has settled.
  click(tl, root, at + 6.4)
  busy(at + 6.45)
  sweep(tl, root, at + 6.45)
  const refilled = fillCascade(tl, root, 1, at + 6.5)
  done(refilled)
  if (options.caption) caption(tl, root, 'fill2', at + 6.8, 2.6)

  fade(tl, popup, at + 9.4, 0, 0.2)
  cursorShow(tl, root, at + 9.5, false)
}
