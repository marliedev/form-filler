import { EASE, el } from '../fx'
import type { SceneContext } from '../timeline'

/** Icon fills up, title, claim, "developed by"; then the icon flies into the toolbar as the browser rises. */
export function intro({ tl, root, at, geo }: SceneContext): void {
  const icon = el(root, 'icon')
  const liquid = el(root, 'icon-liquid')
  const texts = [el(root, 'title'), el(root, 'claim'), el(root, 'by')]
  const windowLayer = el(root, 'window')

  tl.fromTo(icon, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: EASE.pop }, at)
  tl.fromTo(liquid, { y: 52 }, { y: 0, duration: 1.1, ease: EASE.appear }, at + 0.3)
  texts.forEach((text, i) => {
    tl.fromTo(text, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: EASE.caption }, at + 1.2 + i * 0.6)
  })

  // Match cut: the intro icon shrinks onto the toolbar icon of the browser window rising from below.
  const from = geo.rect('[data-el=icon]')
  const to = geo.rect('[data-el=toolbar-icon]')
  const scale = from.width > 0 ? to.width / from.width : 1
  const dx = to.x + to.width / 2 - (from.x + from.width / 2)
  const dy = to.y + to.height / 2 - (from.y + from.height / 2)
  tl.to(texts, { opacity: 0, y: -12, duration: 0.5, ease: EASE.move, stagger: 0.05 }, at + 4.6)
  tl.to(icon, { x: dx, y: dy, scale, duration: 1.1, ease: EASE.move }, at + 4.7)
  tl.fromTo(windowLayer, { opacity: 0, y: 300 }, { opacity: 1, y: 0, duration: 1.0, ease: EASE.caption }, at + 4.8)
  tl.set(icon, { opacity: 0 }, at + 5.8)
  tl.set(el(root, 'intro'), { opacity: 0 }, at + 5.9)
}
