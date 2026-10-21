import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import TemplateTable from '../../src/manage/TemplateTable.vue'
import { useManage } from '../../src/manage/useManage'
import type { AppDef, FieldRule, Template } from '../../src/model/types'
import { getTemplate, saveApp, saveTemplate } from '../../src/storage/repository'

const app: AppDef = { id: 'crm', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] }

function field(id: string, label: string): FieldRule {
  return { id, label, locator: { kind: 'text', name: id }, config: { type: 'companyName' }, slot: null, required: false, appendRunId: false }
}

const template: Template = {
  id: 't1',
  appId: 'crm',
  name: 'Kunde',
  process: null,
  fields: [field('a', 'Firma'), field('b', 'PLZ'), field('c', 'Ort')],
  lastMissing: ['b'],
}

let wrapper: VueWrapper | null = null

async function mountTable() {
  const manage = useManage()
  await manage.load()
  const Host = defineComponent({
    setup: () => () =>
      manage.selectedTemplate.value
        ? h(TemplateTable, { app, template: manage.selectedTemplate.value, busy: false, actions: manage })
        : null,
  })
  wrapper = mount(Host, { attachTo: document.body })
  await flushPromises()
  return { w: wrapper, manage }
}

function button(w: VueWrapper, name: string) {
  const found = w.findAll('button').find((b) => b.attributes('aria-label') === name || b.text() === name)
  if (!found) throw new Error(`missing button ${name}`)
  return found
}

beforeEach(async () => {
  fakeBrowser.reset()
  await saveApp(app)
  await saveTemplate(template)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('TemplateTable', () => {
  it('marks fields missing on the last fill with visible text', async () => {
    const { w } = await mountTable()
    expect(w.text()).toContain('Beim letzten Füllen problematisch')
    const plz = w.findAll('input[type="text"]').find((i) => (i.element as HTMLInputElement).value === 'PLZ')
    expect(plz?.attributes('aria-describedby')).toBeTruthy()
  })

  it('disables the run id switch where it has no effect and explains why', async () => {
    await saveTemplate({
      ...template,
      fields: [field('a', 'Firma'), { ...field('s', 'Land'), locator: { kind: 'select', name: 's' }, config: { type: 'country' } }],
    })
    const { w } = await mountTable()
    const text = w.get<HTMLInputElement>('input[aria-label="Kennung an „Firma“ anhängen"]')
    const select = w.get<HTMLInputElement>('input[aria-label="Kennung an „Land“ anhängen"]')
    expect(text.element.disabled).toBe(false)
    expect(select.element.disabled).toBe(true)
    const hint = document.getElementById(select.attributes('aria-describedby') ?? '')
    expect(hint?.textContent).toContain('Nur bei Textwerten möglich')
  })

  it('moves a field with the keyboard buttons, keeps focus on the row and announces it', async () => {
    const { w, manage } = await mountTable()
    await button(w, '„Firma“ nach unten').trigger('click')
    await flushPromises()
    expect((await getTemplate('t1'))?.fields.map((f) => f.id)).toEqual(['b', 'a', 'c'])
    expect(document.activeElement?.getAttribute('data-move')).toBe('down-a')
    expect(manage.notice.value).toBe('„Firma“ ist jetzt an Position 2 von 3.')
  })

  it('moving to the end moves focus to the other direction button', async () => {
    const { w } = await mountTable()
    await button(w, '„PLZ“ nach unten').trigger('click')
    await flushPromises()
    expect(document.activeElement?.getAttribute('data-move')).toBe('up-b')
  })

  it('deletes a field only after confirmation', async () => {
    const { w } = await mountTable()
    await button(w, 'Feld „PLZ“ löschen').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('dialog')
    expect(dialog?.open).toBe(true)
    expect(document.activeElement?.textContent?.trim()).toBe('Abbrechen')

    await button(w, 'Abbrechen').trigger('click')
    await flushPromises()
    expect((await getTemplate('t1'))?.fields).toHaveLength(3)

    await button(w, 'Feld „PLZ“ löschen').trigger('click')
    await flushPromises()
    await button(w, 'Feld löschen').trigger('click')
    await flushPromises()
    expect((await getTemplate('t1'))?.fields.map((f) => f.id)).toEqual(['a', 'c'])
    expect(document.activeElement?.getAttribute('data-remove')).toBe('c')
  })

  it('picking a type with options opens the options row and validates before saving', async () => {
    const { w } = await mountTable()
    await w.get('select[aria-label="Datentyp für „Firma“"]').setValue('list')
    await flushPromises()
    expect(w.text()).toContain('Bitte mindestens einen Wert eingeben')
    expect(w.text()).toContain('Optionen unvollständig')

    const textarea = w.get('textarea[data-input="values"]')
    await textarea.setValue('A\n\nB')
    await w.get('form[role="group"]').trigger('submit')
    await flushPromises()
    expect((await getTemplate('t1'))?.fields[0]?.config).toEqual({ type: 'list', values: ['A', 'B'] })
    expect(w.find('form[role="group"]').exists()).toBe(false)
  })

  it.each([
    { from: 0, to: 2, expected: ['b', 'a', 'c'] },
    { from: 0, to: 1, expected: ['a', 'b', 'c'] },
    { from: 2, to: 0, expected: ['c', 'a', 'b'] },
    { from: 2, to: 1, expected: ['a', 'c', 'b'] },
  ])('dragging row $from onto row $to inserts it before that row', async ({ from, to, expected }) => {
    const { w } = await mountTable()
    const handles = w.findAll('[draggable="true"]')
    const rows = w.findAll('tbody tr')
    await handles[from]!.trigger('dragstart')
    await rows[to]!.trigger('dragover')
    await rows[to]!.trigger('drop')
    await flushPromises()
    expect((await getTemplate('t1'))?.fields.map((f) => f.id)).toEqual(expected)
  })

  it('keeps an unsaved template name while fields are saved meanwhile', async () => {
    const { w, manage } = await mountTable()
    const name = w.get('input[required]')
    await name.setValue('Kunde neu')
    await manage.updateField('a', { required: true })
    await manage.refresh()
    await flushPromises()
    expect((name.element as HTMLInputElement).value).toBe('Kunde neu')
  })

  it('toggles Pflicht and edits the label', async () => {
    const { w } = await mountTable()
    await w.get('input[aria-label="Pflichtfeld „Ort“"]').setValue(true)
    const label = w.get('input[aria-label="Bezeichnung von Feld 1"]')
    await label.setValue('Firmenname')
    await flushPromises()
    const saved = await getTemplate('t1')
    expect(saved?.fields[2]?.required).toBe(true)
    expect(saved?.fields[0]?.label).toBe('Firmenname')
  })
})
