import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import AppList from '../../src/manage/AppList.vue'
import { useManage } from '../../src/manage/useManage'
import type { AppDef, Template } from '../../src/model/types'
import { saveApp, saveTemplate } from '../../src/storage/repository'

const SOURCE = 'https://team.example.com/templates.json'
const crm: AppDef = { id: 'crm', name: 'CRM', urlPatterns: ['https://crm.example.com/*'] }
const synced: Template = { id: 't1', appId: 'crm', name: 'Kunde', process: null, fields: [], lastMissing: [], source: { templateId: 'ft1', fingerprint: 'fp' } }
const own: Template = { id: 't2', appId: 'crm', name: 'Eigene', process: null, fields: [], lastMissing: [] }

let wrapper: VueWrapper | null = null

async function mountList() {
  const manage = useManage()
  await manage.load()
  const Host = defineComponent({
    setup: () => () =>
      h(AppList, {
        apps: manage.apps.value,
        selectedApp: manage.selectedApp.value,
        templates: manage.templates.value,
        selectedTemplateId: manage.selectedTemplate.value?.id ?? null,
        busy: manage.busy.value,
        actions: manage,
      }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  await flushPromises()
  return { w: wrapper, manage }
}

function buttons(w: VueWrapper, name: string) {
  return w.findAll('button').filter((b) => b.text() === name)
}

function fieldByLabel(w: VueWrapper, label: string): HTMLInputElement {
  const found = w.findAll('label').find((l) => l.text() === label)
  const id = found?.attributes('for')
  const el = id === undefined ? null : document.getElementById(id)
  if (!(el instanceof HTMLInputElement)) throw new Error(`missing field ${label}`)
  return el
}

beforeEach(async () => {
  fakeBrowser.reset()
  vi.restoreAllMocks()
  await saveApp(crm)
  await saveTemplate(synced)
  await saveTemplate(own)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('AppList – template source', () => {
  it('shows the source address and saves it together with name and patterns', async () => {
    await saveApp({ ...crm, source: { url: SOURCE, appId: null } })
    const { w, manage } = await mountList()
    const spy = vi.spyOn(manage, 'saveApp').mockResolvedValue(true)
    const field = fieldByLabel(w, 'Vorlagen-Quelle (Adresse)')
    expect(field.value).toBe(SOURCE)
    field.value = 'https://team.example.com/v2.json'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(buttons(w, 'Speichern')[0]?.attributes('disabled')).toBeUndefined()
    await w.find('form').trigger('submit')
    expect(spy).toHaveBeenCalledWith({ id: 'crm', name: 'CRM', urlPatterns: ['https://crm.example.com/*'], sourceUrl: 'https://team.example.com/v2.json' })
  })

  it('offers "Abgleichen" only when the app has a source and runs the sync', async () => {
    const without = await mountList()
    expect(buttons(without.w, 'Abgleichen')).toHaveLength(0)
    without.w.unmount()
    wrapper = null

    await saveApp({ ...crm, source: { url: SOURCE, appId: null } })
    const { w, manage } = await mountList()
    const spy = vi.spyOn(manage, 'syncApp').mockResolvedValue(true)
    const button = buttons(w, 'Abgleichen')[0]
    expect(button).toBeDefined()
    await button?.trigger('click')
    expect(spy).toHaveBeenCalledWith('crm')
  })

  it('marks synced templates with „Quelle“', async () => {
    const { w } = await mountList()
    const items = w.findAll('li button').map((b) => b.text())
    expect(items.find((t) => t.startsWith('Kunde'))).toContain('Quelle')
    expect(items.find((t) => t.startsWith('Eigene'))).not.toContain('Quelle')
  })
})
