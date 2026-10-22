import { caption, click, cursorJump, cursorShow, cursorTo, EASE, el, fade, fillCascade, setText, show, sweep, zoom } from '../fx'
import type { SceneContext } from '../timeline'

export interface FillOptions {
  /** Captions on, or off for a bare demo. */
  caption: boolean
  /** `full` zooms onto the customer number; `teaser` keeps its own, wider framing. */
  camera: 'full' | 'teaser'
}

const STATUS = 'Kundenanlage: 12 von 12 befüllt'

/** One click fills the form; the status and badge report success; a second click brings new data. */
export function fill({ tl, root, at, geo }: SceneContext, options: FillOptions): void {
  const popup = el(root, 'popup')
  const fillButton = el(root, 'fill-button')
  const badge = el(root, 'badge')

  // The template now exists: the popup lists it instead of the empty-list hint.
  show(tl, el(root, 'popup-noapp'), at, 'none')
  show(tl, el(root, 'popup-app'), at, 'block')
  show(tl, el(root, 'template-row'), at, 'block')
  show(tl, el(root, 'no-templates'), at, 'none')
  show(tl, el(root, 'new-template-form'), at, 'none')
  fade(tl, popup, at, 1, 0.25)

  cursorJump(tl, root, geo.point('[data-el=toolbar-icon]'), at)
  cursorShow(tl, root, at + 0.1, true)
  cursorTo(tl, root, geo.point('[data-el=fill-button]'), at + 0.6, 0.4)
  click(tl, root, at + 1.0)
  tl.to(fillButton, { opacity: 0.6, duration: 0.1 }, at + 1.0)
  sweep(tl, root, at + 1.1)
  const filled = fillCascade(tl, root, 0, at + 1.2)
  if (options.caption) caption(tl, root, 'fill1', at + 3.4, 2)

  const reported = Math.max(filled, at + 3.6)
  tl.to(fillButton, { opacity: 1, duration: 0.1 }, reported)
  show(tl, el(root, 'status'), reported, 'flex')
  setText(tl, el(root, 'status-text'), STATUS, reported)
  tl.set(badge, { opacity: 1 }, reported)
  tl.fromTo(badge, { scale: 0.4 }, { immediateRender: false, scale: 1, duration: 0.4, ease: EASE.pop }, reported)

  if (options.camera === 'full') {
    const focus = { ...geo.field('customerNo'), scale: 1.8 }
    zoom(tl, root, focus, at + 4.0)
    zoom(tl, root, { ...focus, scale: 1 }, at + 5.6)
  }

  click(tl, root, at + 6.0)
  tl.to(fillButton, { opacity: 0.6, duration: 0.1 }, at + 6.0)
  sweep(tl, root, at + 6.1)
  const refilled = fillCascade(tl, root, 1, at + 6.2)
  tl.to(fillButton, { opacity: 1, duration: 0.1 }, refilled)
  if (options.caption) caption(tl, root, 'fill2', at + 6.4, 3)

  fade(tl, popup, at + 9.4, 0, 0.2)
  cursorShow(tl, root, at + 9.5, false)
}
