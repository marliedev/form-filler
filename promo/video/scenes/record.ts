import { FIELDS } from '../data'
import { caption, caret, click, cursorShow, cursorTo, EASE, el, fade, setText, show, typeText } from '../fx'
import { BROWSER } from '../stage'
import type { SceneContext } from '../timeline'

const BOX_INSET = 3

function count(n: number): string {
  return `${n} ${n === 1 ? 'Feld' : 'Felder'}`
}

/** New template, recording bar, two fields captured in detail, the rest in time-lapse, save. */
export function record({ tl, root, at, geo }: SceneContext): void {
  const popup = el(root, 'popup')
  const bar = el(root, 'bar')
  const popover = el(root, 'popover')
  const pending = el(root, 'pending')
  const barCount = el(root, 'bar-count')

  /** Boxes live inside the browser element, so field rects translate to browser coordinates. */
  const boxOf = (key: string) => {
    const r = geo.rect(`[data-field=${key}]`)
    return { left: r.x - BROWSER.left - BOX_INSET, top: r.y - BROWSER.top - BOX_INSET, width: r.width + 2 * BOX_INSET, height: r.height + 2 * BOX_INSET }
  }

  // Create the template from the popup.
  cursorTo(tl, root, geo.point('[data-el=new-template]'), at, 0.5)
  click(tl, root, at + 0.6)
  show(tl, el(root, 'new-template-form'), at + 0.7, 'grid')
  caret(tl, el(root, 'newtpl-caret'), at + 0.8, at + 1.8)
  typeText(tl, el(root, 'newtpl-name'), '', 'Kundenanlage', at + 0.9, 55)
  cursorTo(tl, root, geo.point('[data-el=newtpl-submit]'), at + 1.9, 0.4)
  click(tl, root, at + 2.3)
  fade(tl, popup, at + 2.4, 0, 0.2)
  tl.fromTo(bar, { opacity: 0, y: 40 }, { immediateRender: false, opacity: 1, y: 0, duration: 0.4, ease: EASE.caption }, at + 2.6)
  caption(tl, root, 'record1', at + 3.0, 4)

  // Two fields in detail: click, popover with the suggested type, accept.
  let captured = 0
  const capture = (key: string, start: number, detail: boolean): number => {
    const field = FIELDS.find((f) => f.key === key)!
    const box = boxOf(key)
    cursorTo(tl, root, geo.field(key, 0.3, 0.5), start, detail ? 0.45 : 0.2)
    const clicked = detail ? start + 0.5 : start + 0.2
    click(tl, root, clicked)
    let accepted = clicked
    if (detail) {
      tl.set(pending, { ...box, opacity: 1 }, clicked)
      setText(tl, el(root, 'popover-title'), `Feld „${field.label}“`, clicked)
      setText(tl, el(root, 'popover-type'), field.typeLabel, clicked)
      show(tl, el(root, 'popover-slot'), clicked, field.key === 'company' ? 'none' : 'block')
      tl.set(popover, { left: box.left, top: box.top + box.height + 8 }, clicked)
      tl.fromTo(popover, { opacity: 0, y: -6 }, { immediateRender: false, opacity: 1, y: 0, duration: 0.25, ease: EASE.appear }, clicked + 0.1)
      cursorTo(tl, root, geo.point('[data-el=popover-accept]'), clicked + 0.7, 0.4)
      accepted = clicked + 1.1
      click(tl, root, accepted)
      fade(tl, popover, accepted + 0.1, 0, 0.15)
      tl.set(pending, { opacity: 0 }, accepted + 0.1)
    }
    captured += 1
    tl.set(root.querySelector(`[data-captured=${key}]`)!, { ...box, opacity: 1 }, accepted + 0.1)
    setText(tl, barCount, count(captured), accepted + 0.1)
    return accepted + 0.1
  }

  let t = capture('company', at + 3.2, true)
  t = capture('email', Math.max(t + 0.3, at + 5.2), true)
  caption(tl, root, 'record2', at + 7.4, 2.5)
  t = at + 7.6
  for (const f of FIELDS.filter((f) => f.key !== 'company' && f.key !== 'email')) {
    capture(f.key, t, false)
    t += 0.33
  }

  // Save.
  caption(tl, root, 'record3', at + 11.2, 2.4)
  cursorTo(tl, root, geo.point('[data-el=bar-save]'), at + 11.4, 0.45)
  click(tl, root, at + 11.9)
  show(tl, el(root, 'bar-live'), at + 12.1, 'none')
  show(tl, el(root, 'saved'), at + 12.1, 'inline')
  fade(tl, bar, at + 13.4, 0, 0.3)
  tl.to(root.querySelectorAll('[data-captured]'), { opacity: 0, duration: 0.3 }, at + 13.4)
  cursorShow(tl, root, at + 13.4, false)
}
