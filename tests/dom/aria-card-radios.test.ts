import { beforeEach, describe, expect, it } from 'vitest'
import { describeElement, findElement } from '../../src/dom/locator'
import { fillElement } from '../../src/dom/fill'
import { resolveControl } from '../../src/recorder/useRecorder'

// Card-style custom radios: buttons with role=radio, a title plus a description, the group
// labelled only via aria-label, values in a data attribute.
beforeEach(() => {
  document.body.innerHTML = `
    <div role="radiogroup" aria-label="Kundenart" class="grid">
      <button type="button" role="radio" aria-checked="false" tabindex="0" data-radio-value="standard">
        <span class="card__title">Standardkunde</span><span class="card__description">Eigenständiger Kunde ohne Zuordnung.</span>
      </button>
      <button type="button" role="radio" aria-checked="false" tabindex="-1" data-radio-value="sub_unit">
        <span class="card__title">Untereinheit</span><span class="card__description">Wird einem bestehenden Kunden zugeordnet.</span>
      </button>
      <button type="button" role="radio" aria-checked="false" tabindex="-1" data-radio-value="legacy">
        <span class="card__title"><span>Altkunde <span class="badge">Nur für Admins</span></span></span><span class="card__description">Migrierter Vertrag.</span>
      </button>
    </div>`
  const radios = Array.from(document.querySelectorAll<HTMLElement>('[role="radio"]'))
  for (const r of radios) {
    r.addEventListener('click', () => {
      for (const o of radios) o.setAttribute('aria-checked', String(o === r))
    })
  }
})

const group = () => document.querySelector<HTMLElement>('[role="radiogroup"]') as HTMLElement
const card = (value: string) => document.querySelector<HTMLElement>(`[data-radio-value="${value}"]`) as HTMLElement

describe('card-style ARIA radio group', () => {
  it('resolves a click inside a card to the whole group', () => {
    const inner = card('sub_unit').querySelector('.card__title') as Element
    expect(resolveControl(inner)).toBe(group())
  })

  it('can be found again via its aria-label alone', () => {
    const loc = describeElement(group())
    expect(findElement(document, loc)).toEqual({ status: 'found', el: group() })
  })

  it('selects a card by its title', async () => {
    const out = await fillElement(group(), { kind: 'choice', mode: 'fixed', values: ['Untereinheit'] }, 'radiogroup')
    expect(out).toEqual({ status: 'filled', shown: 'Untereinheit' })
    expect(card('sub_unit').getAttribute('aria-checked')).toBe('true')
  })

  it('selects a card by its data value', async () => {
    const out = await fillElement(group(), { kind: 'choice', mode: 'fixed', values: ['legacy'] }, 'radiogroup')
    expect(out.status).toBe('filled')
    expect(card('legacy').getAttribute('aria-checked')).toBe('true')
  })

  it('selects exactly one card at random', async () => {
    const out = await fillElement(group(), { kind: 'choice', mode: 'random', values: [] }, 'radiogroup')
    expect(out.status).toBe('filled')
    expect(document.querySelectorAll('[aria-checked="true"]')).toHaveLength(1)
  })
})
