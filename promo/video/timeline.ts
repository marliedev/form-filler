import { gsap } from 'gsap'
import { TEASER_FOCUS } from './camera'
import { FIELDS } from './data'
import { el } from './fx'
import { measure, type Geometry, type MeasurePass } from './geometry'
import { SCENES, sceneStart, TEASER_DURATION, TOTAL } from './schedule'
import { intro } from './scenes/intro'
import { problem } from './scenes/problem'
import { detect } from './scenes/detect'
import { record } from './scenes/record'
import { fill } from './scenes/fill'
import { shortcut } from './scenes/shortcut'
import { manage } from './scenes/manage'
import { outro } from './scenes/outro'
import type { Mode } from './video-api'

/** What every scene function receives: the shared timeline, the stage root, its absolute start and measured geometry. */
export interface SceneContext {
  tl: gsap.core.Timeline
  root: HTMLElement
  at: number
  geo: Geometry
}

/**
 * Everything the cursor visits, measured before the first tween touches the DOM. Two layout
 * states of the popup differ in height (empty list vs. one template row), so each is measured
 * in the state the scenes will show it in.
 */
const MEASURED: readonly MeasurePass[] = [
  {
    selectors: [
      '[data-el=icon]', '[data-el=toolbar-icon]', '[data-el=browser]', '[data-el=popup]',
      '[data-el=newapp-name]', '[data-el=newapp-submit]', '[data-el=allow]',
      '[data-el=bar-save]', '[data-el=popover]', '[data-el=popover-accept]', '[data-el=export]', '[data-el=export-one]',
      '[data-row=phone] [data-el=switch-required]',
      ...FIELDS.map((f) => `[data-field=${f.key}]`),
      ...FIELDS.map((f) => `[data-row=${f.key}]`),
    ],
  },
  {
    // Recording scene: the app exists, the template list is still empty.
    show: [['[data-el=popup-app]', 'block'], ['[data-el=new-template-form]', 'grid']],
    hide: ['[data-el=popup-noapp]'],
    selectors: ['[data-el=new-template]', '[data-el=newtpl-name]', '[data-el=newtpl-submit]'],
  },
  {
    // Fill scene: one template row, no empty-list hint.
    show: [['[data-el=popup-app]', 'block'], ['[data-el=template-row]', 'block'], ['[data-el=status]', 'flex']],
    hide: ['[data-el=popup-noapp]', '[data-el=no-templates]'],
    selectors: ['[data-el=fill-button]', '[data-el=template-row]'],
  },
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
    detect(ctx('detect'))
    record(ctx('record'))
    fill(ctx('fill'), { caption: true, camera: 'full' })
    shortcut(ctx('shortcut'))
    manage(ctx('manage'))
    outro(ctx('outro'))
    // Pins the total length even if the last scene ends early.
    tl.set(root, {}, TOTAL)
  } else {
    teaser({ tl, root, at: 0, geo })
    tl.set(root, {}, TEASER_DURATION)
  }
  return tl
}

/**
 * The README teaser: no intro, the window already zoomed onto form and popup, then the fill
 * scene with its two captions. The last two optional fields sit under the caption band.
 */
function teaser({ tl, root, geo }: SceneContext): void {
  tl.addLabel('teaser', 0)
  tl.set(el(root, 'intro'), { opacity: 0 }, 0)
  tl.set(el(root, 'window'), { opacity: 1, transformOrigin: `${TEASER_FOCUS.x}px ${TEASER_FOCUS.y}px`, scale: TEASER_FOCUS.scale }, 0)
  tl.set(el(root, 'glow'), { opacity: 0.5 }, 0)
  fill({ tl, root, at: 0.2, geo }, { caption: true, camera: 'teaser' })
}
