import { beforeEach, describe, expect, it } from 'vitest'
import { describeElement, displayLabel, findElement } from '../../src/dom/locator'
import { fillElement } from '../../src/dom/fill'

// Component-library checkbox: the <label> sits next to the input without `for`,
// the input has no id/name; only aria-describedby points at a generated id.
beforeEach(() => {
  document.body.innerHTML = `
    <form>
      <div class="checkbox" id="newsletter-opt-in">
        <div class="checkbox__input"><input type="checkbox" aria-describedby="v-7" value="false"><span class="checkbox__box"></span></div>
        <div class="checkbox__text"><label class="text-sm">Newsletter abonnieren</label><p id="v-7">Erhält monatlich Neuigkeiten.</p></div>
      </div>
      <div class="checkbox">
        <div class="checkbox__input"><input type="checkbox"><span class="checkbox__box"></span></div>
        <div class="checkbox__text"><label>AGB akzeptiert</label></div>
      </div>
    </form>`
})

const box = (i: number) => document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[i] as HTMLInputElement

describe('checkbox with an unlinked sibling label', () => {
  it('takes the label of its own component wrapper', () => {
    expect(displayLabel(box(0))).toBe('Newsletter abonnieren')
    expect(describeElement(box(0)).label).toBe('newsletter abonnieren')
  })

  it('is found again and not confused with the neighbouring checkbox', () => {
    expect(findElement(document, describeElement(box(0)))).toEqual({ status: 'found', el: box(0) })
    expect(findElement(document, describeElement(box(1)))).toEqual({ status: 'found', el: box(1) })
  })

  it('gets checked by the fill', async () => {
    const out = await fillElement(box(0), { kind: 'checkbox', checked: true }, 'checkbox')
    expect(out.status).toBe('filled')
    expect(box(0).checked).toBe(true)
  })
})
