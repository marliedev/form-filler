import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TestForm from '../../test-site/src/TestForm.vue'
import { fillElement, nextFrame } from '../../src/dom/fill'
import { findElement, type FormControl } from '../../src/dom/locator'
import type { FieldLocator } from '../../src/model/types'

let wrapper: VueWrapper | null = null

function mountForm(): VueWrapper {
  wrapper = mount(TestForm, { attachTo: document.body })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

function find(loc: FieldLocator): FormControl {
  const res = findElement(document.body, loc)
  if (res.status !== 'found') throw new Error(`${JSON.stringify(loc)} → ${res.status}`)
  return res.el
}

interface Model {
  company: string
  customerNo: string
  notes: string
  startDate: string
  birthDate: string
  industry: string
  role: string
  country: string
  billingDiffers: boolean
  billing: { street: string }
}

async function readModel(): Promise<Model> {
  await nextFrame()
  const pre = document.querySelector('[data-testid="model"]')
  return JSON.parse(pre?.textContent ?? '{}') as Model
}

describe('fillElement against Vue v-model (anti-goal: visually filled, internally empty)', () => {
  it('text, textarea, dates, maxlength, select, radio, checkbox and combobox reach the model', async () => {
    mountForm()
    const outcomes = [
      await fillElement(find({ kind: 'text', name: 'company' }), { kind: 'text', value: 'Muster GmbH' }, 'text'),
      await fillElement(find({ kind: 'text', name: 'customer_no' }), { kind: 'text', value: 'KD-0000000000000000000099' }, 'text'),
      await fillElement(find({ kind: 'textarea', name: 'notes' }), { kind: 'text', value: 'Hallo Welt' }, 'textarea'),
      await fillElement(find({ kind: 'date', name: 'start_date' }), { kind: 'date', iso: '2025-01-31' }, 'date'),
      await fillElement(find({ kind: 'text', name: 'birth_date' }), { kind: 'date', iso: '1990-07-04' }, 'text'),
      await fillElement(find({ kind: 'select', name: 'industry' }), { kind: 'choice', mode: 'fixed', values: ['Handel'] }, 'select'),
      await fillElement(find({ kind: 'radiogroup', name: 'role' }), { kind: 'choice', mode: 'fixed', values: ['Lernmanager'] }, 'radiogroup'),
      await fillElement(find({ kind: 'checkbox', name: 'billing_differs' }), { kind: 'checkbox', checked: true }, 'checkbox'),
      await fillElement(find({ kind: 'combobox', label: 'land' }), { kind: 'choice', mode: 'fixed', values: ['Österreich'] }, 'combobox'),
    ]
    expect(outcomes.filter((o) => o.status === 'failed')).toEqual([])

    const model = await readModel()
    expect(model).toMatchObject({
      company: 'Muster GmbH',
      customerNo: 'KD-00000000000000000',
      notes: 'Hallo Welt',
      startDate: '2025-01-31',
      birthDate: '04.07.1990',
      industry: 'handel',
      role: 'Lernmanager',
      billingDiffers: true,
      country: 'at',
    })
  })

  it('a combobox random choice skips the disabled option and lands in the model', async () => {
    mountForm()
    const out = await fillElement(find({ kind: 'combobox', label: 'land' }), { kind: 'choice', mode: 'random', values: [] }, 'combobox', () => 0.999)
    expect(out).toEqual({ status: 'filled', shown: 'Schweiz' })
    expect((await readModel()).country).toBe('ch')
  })

  it('a field revealed by the checkbox is findable after nextFrame and fillable', async () => {
    mountForm()
    expect(findElement(document.body, { kind: 'text', name: 'billing_street' }).status).toBe('missing')
    await fillElement(find({ kind: 'checkbox', name: 'billing_differs' }), { kind: 'checkbox', checked: true }, 'checkbox')
    await nextFrame()
    const res = findElement(document.body, { kind: 'text', name: 'billing_street' })
    expect(res.status).toBe('found')
    if (res.status !== 'found') return
    await fillElement(res.el, { kind: 'text', value: 'Musterweg 1' }, 'text')
    expect((await readModel()).billing.street).toBe('Musterweg 1')
  })

  it('"Weiter" switches to step 2 without reload', async () => {
    mountForm()
    await fillElement(find({ kind: 'text', name: 'company' }), { kind: 'text', value: 'Muster GmbH' }, 'text')
    document.querySelector<HTMLButtonElement>('button[type=submit]')?.click()
    await nextFrame()
    expect(findElement(document.body, { kind: 'text', name: 'contact_first_name' }).status).toBe('found')
    expect(findElement(document.body, { kind: 'text', name: 'company' }).status).toBe('missing')
  })
})
