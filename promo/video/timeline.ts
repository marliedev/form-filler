import { gsap } from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'
import { SCENES, sceneStart, TEASER_DURATION, TOTAL } from './schedule'
import type { Mode } from './video-api'

gsap.registerPlugin(TextPlugin)

/** What every scene function receives: the shared timeline, the stage root and its absolute start. */
export interface SceneContext {
  tl: gsap.core.Timeline
  root: HTMLElement
  at: number
}

/**
 * One paused timeline per mode. The render script drives it with `seek(t)`, so nothing here may
 * depend on wall-clock time; scenes only add tweens at absolute positions.
 */
export function buildTimeline(root: HTMLElement, mode: Mode): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true })
  if (mode === 'full') {
    for (const scene of SCENES) tl.addLabel(scene.id, sceneStart(scene.id))
    // Scenes are registered here from Task 5 on; the no-op pins the total length until then.
    tl.set(root, {}, TOTAL)
  } else {
    tl.addLabel('teaser', 0)
    tl.set(root, {}, TEASER_DURATION)
  }
  return tl
}
