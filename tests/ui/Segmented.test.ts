import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Segmented from '../../src/ui/Segmented.vue'

const options = [
  { value: 'all', label: 'Alle Felder' },
  { value: 'required', label: 'Nur Pflicht' },
]

function mountSegmented(modelValue = 'all') {
  return mount(Segmented, {
    props: { modelValue, options, label: 'Umfang' },
    attachTo: document.body,
  })
}

describe('Segmented', () => {
  it('renders a labelled radio group with a roving tabindex', () => {
    const w = mountSegmented()
    expect(w.get('[role="radiogroup"]').attributes('aria-label')).toBe('Umfang')
    const radios = w.findAll('[role="radio"]')
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['true', 'false'])
    expect(radios.map((r) => r.attributes('tabindex'))).toEqual(['0', '-1'])
    w.unmount()
  })

  it('selects and focuses the next option with the arrow keys, wrapping around', async () => {
    const w = mountSegmented()
    const radios = w.findAll('[role="radio"]')
    await radios[0]?.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['required'])
    expect(document.activeElement).toBe(radios[1]?.element)
    await radios[0]?.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')?.[1]).toEqual(['required'])
    w.unmount()
  })

  it('selects on click', async () => {
    const w = mountSegmented()
    await w.findAll('[role="radio"]')[1]?.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['required'])
    w.unmount()
  })
})
