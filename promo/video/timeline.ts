import { gsap } from 'gsap'
import { FIELDS } from './data'
import { measure, type Geometry } from './geometry'
import { SCENES, sceneStart, TEASER_DURATION, TOTAL } from './schedule'
import { intro } from './scenes/intro'
import { problem } from './scenes/problem'
import type { Mode } from './video-api'

/** What every scene function receives: the shared timeline, the stage root, its absolute start and measured geometry. */
export interface SceneContext {
  tl: gsap.core.Timeline
  root: HTMLElement
  at: number
  geo: Geometry
}

/** Everything the cursor visits, measured before the first tween touches the DOM. */
const MEASURED = [
  '[data-el=icon]', '[data-el=toolbar-icon]', '[data-el=newapp-name]', '[data-el=newapp-submit]', '[data-el=allow]',
  '[data-el=new-template]', '[data-el=newtpl-name]', '[data-el=newtpl-submit]', '[data-el=fill-button]',
  '[data-el=bar-save]', '[data-el=popover]', '[data-el=popover-accept]', '[data-el=export]', '[data-el=export-one]',
  '[data-el=browser]', '[data-el=popup]',
  ...FIELDS.map((f) => `[data-field=${f.key}]`),
  ...FIELDS.map((f) => `[data-row=${f.key}]`),
]

/**
 * One paused timeline per mode. The render script drives it with `seek(t)`, so nothing here may
 * depend on wall-clock time; scenes only add tweens at absolute positions.
 */
export function buildTimeline(root: HTMLElement, mode: Mode): gsap.core.Timeline {
  const geo = measure(root, MEASURED)
  const tl = gsap.timeline({ paused: true })
  if (mode === 'full') {
    for (const scene of SCENES) tl.addLabel(scene.id, sceneStart(scene.id))
    const ctx = (id: (typeof SCENES)[number]['id']): SceneContext => ({ tl, root, at: sceneStart(id), geo })
    intro(ctx('intro'))
    problem(ctx('problem'))
    // Remaining scenes follow in later tasks; the no-op pins the total length until then.
    tl.set(root, {}, TOTAL)
  } else {
    tl.addLabel('teaser', 0)
    tl.set(root, {}, TEASER_DURATION)
  }
  return tl
}
