import { EASE, el, fade } from '../fx'
import type { SceneContext } from '../timeline'

/** Everything fades to the dark stage; icon, title, repository address, browser line, copyright. */
export function outro({ tl, root, at }: SceneContext): void {
  fade(tl, el(root, 'window'), at, 0, 0.3)
  fade(tl, el(root, 'outro'), at + 0.2, 1, 0.5)
  const lines = ['outro-repo', 'outro-browsers', 'outro-copyright'].map((name) => el(root, name))
  lines.forEach((line, i) => {
    tl.fromTo(line, { y: 16, opacity: 0 }, { immediateRender: false, y: 0, opacity: 1, duration: 0.5, ease: EASE.caption }, at + 0.8 + i * 0.4)
  })
}
