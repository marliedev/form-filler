import { caption, caret, click, cursorJump, cursorShow, cursorTo, EASE, el, fade, show, typeText, zoom } from '../fx'
import { zoomed } from '../geometry'
import type { SceneContext } from '../timeline'

const ZOOM = 1.6

/** Toolbar click, popup without an app, name typed into the prefilled form, permission granted. */
export function detect({ tl, root, at, geo }: SceneContext): void {
  const popup = el(root, 'popup')
  const veil = el(root, 'veil')
  const permission = el(root, 'permission')
  const focus = { ...geo.point('[data-el=popup]'), scale: ZOOM }
  const z = (selector: string) => zoomed(geo.point(selector), focus, ZOOM)

  cursorJump(tl, root, { x: 1300, y: 420 }, at)
  cursorShow(tl, root, at, true)
  cursorTo(tl, root, geo.point('[data-el=toolbar-icon]'), at + 0.1, 0.5)
  click(tl, root, at + 0.6)

  tl.fromTo(popup, { opacity: 0, y: -8 }, { immediateRender: false, opacity: 1, y: 0, duration: 0.3, ease: EASE.appear }, at + 0.7)
  tl.to(veil, { opacity: 0.55, duration: 0.4 }, at + 0.9)
  zoom(tl, root, focus, at + 1.0)
  caption(tl, root, 'detect1', at + 1.6, 3)

  cursorTo(tl, root, z('[data-el=newapp-name]'), at + 1.8, 0.4)
  click(tl, root, at + 2.2)
  caret(tl, el(root, 'newapp-caret'), at + 2.2, at + 3.2)
  typeText(tl, el(root, 'newapp-name'), '', 'Kundenportal', at + 2.25, 60)
  cursorTo(tl, root, z('[data-el=newapp-submit]'), at + 3.2, 0.4)
  click(tl, root, at + 3.6)

  // Requesting the host permission closes the popup; the browser asks, then the popup returns with the app.
  fade(tl, popup, at + 3.7, 0, 0.2)
  tl.fromTo(permission, { opacity: 0, y: -8 }, { immediateRender: false, opacity: 1, y: 0, duration: 0.3, ease: EASE.appear }, at + 3.8)
  cursorTo(tl, root, z('[data-el=allow]'), at + 4.4, 0.4)
  click(tl, root, at + 4.9)
  fade(tl, permission, at + 5.0, 0, 0.2)
  show(tl, el(root, 'popup-noapp'), at + 5.1, 'none')
  show(tl, el(root, 'popup-app'), at + 5.1, 'block')
  fade(tl, popup, at + 5.1, 1, 0.25)
  caption(tl, root, 'detect2', at + 5.3, 2.3)

  zoom(tl, root, { ...focus, scale: 1 }, at + 6.8)
  tl.to(veil, { opacity: 0, duration: 0.5 }, at + 6.8)
  // The popup stays open: the recording scene continues in it.
}
