import { caption, caret, click, cursorJump, cursorShow, cursorTo, glow, typeText } from '../fx'
import type { SceneContext } from '../timeline'

const HUMAN_MS = 65
const QUICK_MS = 45

/** A person types into the empty form by hand, hesitates, deletes, tries again, wipes. */
export function problem({ tl, root, at, geo }: SceneContext): void {
  const field = root.querySelector<HTMLElement>('[data-field=company]')!
  const value = field.querySelector<HTMLElement>('[data-el=value]')!
  const caretEl = field.querySelector<HTMLElement>('[data-el=caret]')!

  caption(tl, root, 'problem', at, 4.5)

  cursorJump(tl, root, { x: 960, y: 760 }, at)
  cursorShow(tl, root, at + 0.2, true)
  cursorTo(tl, root, geo.field('company', 0.3, 0.5), at + 0.4)
  click(tl, root, at + 0.9)
  caret(tl, caretEl, at + 1.0, at + 4.0)

  let t = typeText(tl, value, '', 'Max', at + 1.0, HUMAN_MS)
  t = typeText(tl, value, 'Max', '', Math.max(t, at + 2.2), HUMAN_MS)
  t = typeText(tl, value, '', 'Nordlicht', Math.max(t, at + 2.8), QUICK_MS)
  typeText(tl, value, 'Nordlicht', '', Math.max(t, at + 3.9), 10)
  glow(tl, field, at + 3.9)

  cursorShow(tl, root, at + 4.6, false)
}
