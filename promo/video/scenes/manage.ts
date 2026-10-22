import { caption, click, cursorJump, cursorShow, cursorTo, EASE, el, fade, setText } from '../fx'
import { BROWSER, SWITCH_COLORS, SWITCH_TRAVEL } from '../stage'
import type { SceneContext } from '../timeline'

const MANAGE_URL = 'chrome-extension://…/manage.html'
const LIFT = '0 12px 30px rgba(0,0,0,0.5), 0 0 0 1px #94aefe'

/** Hard cut to the manage page: drag a row up, flip a required switch, export the template. */
export function manage({ tl, root, at, geo }: SceneContext): void {
  const page = el(root, 'page')
  const manageLayer = el(root, 'manage')
  const rowEmail = root.querySelector<HTMLElement>('[data-row=email]')!
  const rowCompany = root.querySelector<HTMLElement>('[data-row=company]')!
  const switchTrack = root.querySelector<HTMLElement>('[data-row=phone] [data-el=switch-required]')!
  const knob = switchTrack.querySelector<HTMLElement>('[data-el=knob]')!
  const exportDoc = el(root, 'export-doc')
  const rowHeight = geo.rect('[data-row=company]').height

  tl.set(page, { opacity: 0 }, at)
  tl.set(manageLayer, { opacity: 1 }, at)
  tl.set(el(root, 'badge'), { opacity: 0 }, at)
  setText(tl, el(root, 'url'), MANAGE_URL, at)
  caption(tl, root, 'manage', at + 0.3, 4)

  // Drag the e-mail row above the company row.
  cursorJump(tl, root, { x: 700, y: 600 }, at)
  cursorShow(tl, root, at + 0.1, true)
  cursorTo(tl, root, geo.point('[data-row=email]', 0.03, 0.5), at + 0.6, 0.4)
  click(tl, root, at + 1.0)
  tl.set(rowEmail, { zIndex: 2 }, at + 1.0)
  tl.to(rowEmail, { boxShadow: LIFT, duration: 0.15 }, at + 1.0)
  tl.to(rowEmail, { y: -rowHeight, duration: 0.5, ease: EASE.move }, at + 1.2)
  tl.to(rowCompany, { y: rowHeight, duration: 0.5, ease: EASE.move }, at + 1.2)
  tl.to(el(root, 'cursor'), { top: `-=${rowHeight}`, duration: 0.5, ease: EASE.move }, at + 1.2)
  tl.to(rowEmail, { boxShadow: '0 0 0 0 rgba(0,0,0,0), 0 0 0 0 rgba(148,174,254,0)', duration: 0.2 }, at + 1.8)

  // Flip "Pflicht" for the phone number.
  cursorTo(tl, root, geo.point('[data-row=phone] [data-el=switch-required]'), at + 2.2, 0.4)
  click(tl, root, at + 2.6)
  tl.to(switchTrack, { backgroundColor: SWITCH_COLORS.trackOn, duration: 0.2 }, at + 2.65)
  tl.to(knob, { x: SWITCH_TRAVEL, backgroundColor: SWITCH_COLORS.knobOn, duration: 0.2, ease: EASE.appear }, at + 2.65)

  // Export: a small JSON document flies out of the button.
  const button = geo.rect('[data-el=export-one]')
  cursorTo(tl, root, geo.point('[data-el=export-one]'), at + 3.2, 0.4)
  click(tl, root, at + 3.6)
  tl.set(exportDoc, { left: button.x - BROWSER.left, top: button.y - BROWSER.top - BROWSER.chrome, x: 0, y: 0 }, at + 3.6)
  tl.fromTo(exportDoc, { opacity: 0, scale: 0.6 }, { immediateRender: false, opacity: 1, scale: 1, duration: 0.2, ease: EASE.pop }, at + 3.7)
  tl.to(exportDoc, { x: 160, y: 420, opacity: 0, duration: 0.7, ease: 'power2.in' }, at + 3.95)

  fade(tl, manageLayer, at + 4.6, 0, 0.4)
  cursorShow(tl, root, at + 4.6, false)
}
