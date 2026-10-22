import { caption, EASE, fillCascade } from '../fx'
import type { SceneContext } from '../timeline'

const KEYS = ['alt', 'shift', 'f'] as const
const PRESS_DEPTH = 4

/** Three key caps pop in and press one after another; the form fills without the popup. */
export function shortcut({ tl, root, at }: SceneContext): void {
  const keys = KEYS.map((k) => root.querySelector<HTMLElement>(`[data-key=${k}]`)!)

  caption(tl, root, 'shortcut', at + 0.2, 3.5)
  keys.forEach((key, i) => {
    tl.fromTo(key, { opacity: 0, scale: 0.6 }, { immediateRender: false, opacity: 1, scale: 1, duration: 0.3, ease: EASE.pop }, at + 0.4 + i * 0.15)
    // Each cap goes down and stays down until the chord is complete.
    tl.to(key, { y: PRESS_DEPTH, borderBottomWidth: 1, duration: 0.12, ease: EASE.appear }, at + 1.2 + i * 0.3)
  })
  tl.to(keys, { y: 0, borderBottomWidth: 5, duration: 0.15, ease: EASE.appear }, at + 2.2)

  fillCascade(tl, root, 2, at + 1.9)
  tl.to(keys, { opacity: 0, duration: 0.3 }, at + 4.2)
}
