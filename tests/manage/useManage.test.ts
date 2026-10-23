import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { ContentMessage } from '../../src/fill/messages'
import { useManage } from '../../src/manage/useManage'
import { parseExport } from '../../src/model/schema'
import type { AppDef, FieldRule, Template } from '../../src/model/types'
import { getPrefs, getTemplate, listApps, listTemplates, saveApp, saveTemplate, setPrefs } from '../../src/storage/repository'

const crm: AppDef = { id: 'crm', name: 'Kunden CRM', urlPatterns: ['https://crm.example.com/*'] }
const shop: AppDef = { id: 'shop', name: 'Shop', urlPatterns: ['https://shop.example.com/*'] }

function field(id: string, patch: Partial<FieldRule> = {}): FieldRule {
  return {
    id,
    label: id.toUpperCase(),
    locator: { kind: 'text', name: id },
    config: { type: 'companyName' },
    slot: null,
    required: false,
    appendRunId: false,
    ...patch,
  }
}

const tpl: Template = {
  id: 't1',
  appId: 'crm',
  name: 'Kunde',
  process: null,
  fields: [field('a'), field('b'), field('c')],
  lastMissing: [],
}
const tpl2: Template = { ...tpl, id: 't2', name: 'Kontakt', fields: [] }
const shopTpl: Template = { ...tpl, id: 't3', appId: 'shop', name: 'Bestellung', fields: [] }

async function snapshot(): Promise<Record<string, unknown>> {
  return fakeBrowser.storage.local.get(null)
}

async function loaded() {
  const m = useManage()
  await m.load()
  return m
}

beforeEach(async () => {
  fakeBrowser.reset()
  vi.restoreAllMocks()
  await saveApp(crm)
  await saveApp(shop)
  await saveTemplate(tpl)
  await saveTemplate(tpl2)
  await saveTemplate(shopTpl)
})

describe('useManage – loading and selection', () => {
  it('selects the first app and its first template', async () => {
    const m = await loaded()
    expect(m.apps.value.map((a) => a.id)).toEqual(['crm', 'shop'])
    expect(m.selectedApp.value?.id).toBe('crm')
    expect(m.templates.value.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(m.selectedTemplate.value?.id).toBe('t1')
  })

  it('switching the app selects that app’s first template', async () => {
    const m = await loaded()
    m.selectApp('shop')
    expect(m.templates.value.map((t) => t.id)).toEqual(['t3'])
    expect(m.selectedTemplate.value?.id).toBe('t3')
  })
})

describe('useManage – fields', () => {
  it('moveField changes the order and persists it', async () => {
    const m = await loaded()
    await m.moveField('c', 0)
    expect(m.selectedTemplate.value?.fields.map((f) => f.id)).toEqual(['c', 'a', 'b'])
    expect((await getTemplate('t1'))?.fields.map((f) => f.id)).toEqual(['c', 'a', 'b'])
    await m.moveField('c', 99)
    expect((await getTemplate('t1'))?.fields.map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })

  it('updateField to a person type sets slot 1, to an address type slot A, to a slotless type null', async () => {
    const m = await loaded()
    await m.updateField('a', { config: { type: 'firstName' } })
    expect((await getTemplate('t1'))?.fields[0]?.slot).toBe('1')
    await m.updateField('a', { config: { type: 'city' } })
    expect((await getTemplate('t1'))?.fields[0]?.slot).toBe('A')
    await m.updateField('a', { config: { type: 'iban' } })
    expect((await getTemplate('t1'))?.fields[0]?.slot).toBeNull()
  })

  it('updateField keeps a fitting slot and an explicit slot patch wins', async () => {
    const m = await loaded()
    await m.updateField('a', { config: { type: 'firstName' }, slot: '2' })
    await m.updateField('a', { config: { type: 'lastName' } })
    expect((await getTemplate('t1'))?.fields[0]?.slot).toBe('2')
  })

  it('updateField patches only the changed field and keeps lastMissing written meanwhile', async () => {
    const m = await loaded()
    // A fill in another context records missing fields after the tab loaded.
    await saveTemplate({ ...tpl, lastMissing: ['b'] })
    await m.updateField('a', { required: true, label: 'Firma' })
    const saved = await getTemplate('t1')
    expect(saved?.lastMissing).toEqual(['b'])
    expect(saved?.fields[0]).toMatchObject({ id: 'a', required: true, label: 'Firma' })
    expect(m.selectedTemplate.value?.lastMissing).toEqual(['b'])
  })

  it('serializes concurrent edits so none is lost', async () => {
    const m = await loaded()
    await Promise.all([m.updateField('a', { required: true }), m.updateField('b', { appendRunId: true })])
    const saved = await getTemplate('t1')
    expect(saved?.fields[0]?.required).toBe(true)
    expect(saved?.fields[1]?.appendRunId).toBe(true)
  })

  it('removeField drops the field and its lastMissing entry', async () => {
    await saveTemplate({ ...tpl, lastMissing: ['b', 'c'] })
    const m = await loaded()
    await m.removeField('b')
    const saved = await getTemplate('t1')
    expect(saved?.fields.map((f) => f.id)).toEqual(['a', 'c'])
    expect(saved?.lastMissing).toEqual(['c'])
  })
})

describe('useManage – templates and apps', () => {
  it('saveTemplateMeta stores name and process, empty process name means none', async () => {
    const m = await loaded()
    expect(await m.saveTemplateMeta({ name: ' Kunde neu ', process: { name: 'Kundenanlage', step: 2 } })).toBe(true)
    expect(await getTemplate('t1')).toMatchObject({ name: 'Kunde neu', process: { name: 'Kundenanlage', step: 2 } })
    await m.saveTemplateMeta({ name: 'Kunde', process: { name: '  ', step: 1 } })
    expect((await getTemplate('t1'))?.process).toBeNull()
  })

  it('saveTemplateMeta rejects an empty name and an invalid step', async () => {
    const m = await loaded()
    expect(await m.saveTemplateMeta({ name: ' ', process: null })).toBe(false)
    expect(m.error.value?.message).toMatch(/Namen/)
    expect(await m.saveTemplateMeta({ name: 'X', process: { name: 'P', step: 0 } })).toBe(false)
    expect((await getTemplate('t1'))?.name).toBe('Kunde')
  })

  it('duplicateTemplate copies the template with fresh ids, names the copy and selects it', async () => {
    await saveTemplate({ ...tpl, process: { name: 'Anlage', step: 1 }, lastMissing: ['a'] })
    const m = await loaded()
    expect(await m.duplicateTemplate('t1')).toBe(true)
    const copy = m.selectedTemplate.value
    expect(copy).not.toBeNull()
    expect(copy?.id).not.toBe('t1')
    expect(copy?.name).toBe('Kunde (Kopie)')
    expect(copy?.appId).toBe('crm')
    expect(copy?.process).toEqual({ name: 'Anlage', step: 1 })
    expect(copy?.lastMissing).toEqual([])
    expect(copy?.fields.map((f) => f.label)).toEqual(['A', 'B', 'C'])
    expect(copy?.fields.map((f) => f.locator)).toEqual(tpl.fields.map((f) => f.locator))
    expect(new Set(copy?.fields.map((f) => f.id)).size).toBe(3)
    expect(copy?.fields.map((f) => f.id)).not.toContain('a')
    expect((await listTemplates('crm')).map((t) => t.id)).toEqual(['t1', 't2', copy?.id])
    expect(m.notice.value).toBe('Vorlage „Kunde (Kopie)“ angelegt.')
  })

  it('duplicateTemplate of an unknown template fails without writing', async () => {
    const m = await loaded()
    expect(await m.duplicateTemplate('nope')).toBe(false)
    expect(m.error.value?.message).toBe('Vorlage nicht gefunden.')
    expect((await listTemplates()).length).toBe(3)
  })

  it('removeTemplate resets prefs.lastTemplateId pointing to it', async () => {
    await setPrefs({ lastTemplateId: 't1' })
    const m = await loaded()
    await m.removeTemplate('t1')
    expect(await getTemplate('t1')).toBeUndefined()
    expect((await getPrefs()).lastTemplateId).toBeNull()
    expect(m.selectedTemplate.value?.id).toBe('t2')
  })

  it('removeApp deletes its templates and resets prefs.lastTemplateId', async () => {
    await setPrefs({ lastTemplateId: 't2' })
    const m = await loaded()
    await m.removeApp('crm')
    expect((await listApps()).map((a) => a.id)).toEqual(['shop'])
    expect((await listTemplates()).map((t) => t.id)).toEqual(['t3'])
    expect((await getPrefs()).lastTemplateId).toBeNull()
    expect(m.selectedApp.value?.id).toBe('shop')
  })

  it('removeApp keeps an unrelated prefs.lastTemplateId', async () => {
    await setPrefs({ lastTemplateId: 't3' })
    const m = await loaded()
    await m.removeApp('crm')
    expect((await getPrefs()).lastTemplateId).toBe('t3')
  })

  it('saveApp stores name and patterns after the permission for new patterns is granted', async () => {
    const request = vi.fn<(p: unknown) => Promise<boolean>>(async () => true)
    vi.spyOn(fakeBrowser.permissions, 'request').mockImplementation(request as unknown as typeof fakeBrowser.permissions.request)
    const m = await loaded()
    const ok = await m.saveApp({ id: 'crm', name: ' CRM ', urlPatterns: ['https://crm.example.com/*', ' https://crm2.example.com/* ', ''] })
    expect(ok).toBe(true)
    expect(request).toHaveBeenCalledWith({ origins: ['https://crm2.example.com/*'] })
    expect((await listApps())[0]).toEqual({ id: 'crm', name: 'CRM', urlPatterns: ['https://crm.example.com/*', 'https://crm2.example.com/*'] })
  })

  it('saveApp writes nothing when the permission is denied or input is empty', async () => {
    const request = vi.fn<(p: unknown) => Promise<boolean>>(async () => false)
    vi.spyOn(fakeBrowser.permissions, 'request').mockImplementation(request as unknown as typeof fakeBrowser.permissions.request)
    const m = await loaded()
    const before = await snapshot()
    expect(await m.saveApp({ id: 'crm', name: 'CRM', urlPatterns: ['https://other.example.com/*'] })).toBe(false)
    expect(await m.saveApp({ id: 'crm', name: '', urlPatterns: ['https://crm.example.com/*'] })).toBe(false)
    expect(await m.saveApp({ id: 'crm', name: 'CRM', urlPatterns: [' '] })).toBe(false)
    expect(await snapshot()).toEqual(before)
  })
})

describe('useManage – export/import', () => {
  it('exportApp contains only that app and its templates', async () => {
    const m = await loaded()
    const file = await m.exportApp('crm')
    expect(file.filename).toMatch(/^form-filler-kunden-crm-\d{4}-\d{2}-\d{2}\.json$/)
    const parsed = parseExport(file.content)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.apps.map((a) => a.id)).toEqual(['crm'])
    expect(parsed.data.templates.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('exportAll contains everything with a dated filename', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) })
    try {
      const m = await loaded()
      const file = await m.exportAll()
      expect(file.filename).toBe('form-filler-export-2026-10-21.json')
      const parsed = parseExport(file.content)
      expect(parsed.ok && parsed.data.templates.length).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('importFile with invalid text returns a German message and writes nothing', async () => {
    const m = await loaded()
    const onConflict = vi.fn(async () => 'overwrite' as const)
    const before = await snapshot()
    expect(await m.importFile('kein json', onConflict)).toMatch(/kein gültiges JSON/)
    expect(await m.importFile('{"format":"other"}', onConflict)).toMatch(/Ungültige Export-Datei/)
    expect(m.error.value).not.toBeNull()
    expect(onConflict).not.toHaveBeenCalled()
    expect(await snapshot()).toEqual(before)
  })

  it('importFile rejects templates whose app is unknown', async () => {
    const m = await loaded()
    const before = await snapshot()
    const text = JSON.stringify({ format: 'form-filler', version: 1, apps: [], templates: [{ ...shopTpl, id: 'x', appId: 'nope' }] })
    expect(await m.importFile(text, async () => 'overwrite')).toMatch(/App/)
    expect(await snapshot()).toEqual(before)
  })

  it('importFile asks only on id conflicts', async () => {
    const m = await loaded()
    const onConflict = vi.fn(async () => 'copy' as const)
    const fresh: AppDef = { id: 'new', name: 'Neu', urlPatterns: ['https://neu.example.com/*'] }
    const text = JSON.stringify({ format: 'form-filler', version: 1, apps: [fresh], templates: [{ ...tpl2, id: 'n1', appId: 'new' }] })
    expect(await m.importFile(text, onConflict)).toMatch(/1 App, 1 Vorlage/)
    expect(onConflict).not.toHaveBeenCalled()
    expect((await listApps()).map((a) => a.id)).toContain('new')
    expect(m.apps.value.map((a) => a.id)).toContain('new')
  })

  it('importFile on conflict applies the chosen strategy or cancels without writing', async () => {
    const m = await loaded()
    const exported = await m.exportApp('crm')

    const before = await snapshot()
    expect(await m.importFile(exported.content, async () => null)).toMatch(/abgebrochen/)
    expect(await snapshot()).toEqual(before)

    await m.importFile(exported.content, async () => 'copy')
    const templates = await listTemplates()
    expect(templates.filter((t) => t.name === 'Kunde (Kopie)')).toHaveLength(1)
    expect((await listApps())).toHaveLength(3)
  })
})

describe('useManage – recordFields', () => {
  function mockTabs(tabs: { id: number; url: string; windowId: number; lastAccessed?: number }[]) {
    const query = vi.fn<(info: unknown) => Promise<typeof tabs>>(async () => tabs)
    const update = vi.fn<(id: number, props: unknown) => Promise<unknown>>(async () => ({}))
    const focus = vi.fn<(id: number, props: unknown) => Promise<unknown>>(async () => ({}))
    const execute = vi.fn<(injection: unknown) => Promise<unknown[]>>(async () => [])
    const send = vi.fn<(tabId: number, message: ContentMessage) => Promise<unknown>>(async () => ({ ok: true }))
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(query as unknown as typeof fakeBrowser.tabs.query)
    vi.spyOn(fakeBrowser.tabs, 'update').mockImplementation(update as unknown as typeof fakeBrowser.tabs.update)
    vi.spyOn(fakeBrowser.windows, 'update').mockImplementation(focus as unknown as typeof fakeBrowser.windows.update)
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(execute as unknown as typeof fakeBrowser.scripting.executeScript)
    vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation(send as unknown as typeof fakeBrowser.tabs.sendMessage)
    return { update, focus, send }
  }

  it('activates the most recently used tab of the app and starts recording there', async () => {
    const { update, focus, send } = mockTabs([
      { id: 1, url: 'https://shop.example.com/x', windowId: 1, lastAccessed: 50 },
      { id: 2, url: 'https://crm.example.com/a', windowId: 1, lastAccessed: 10 },
      { id: 3, url: 'https://crm.example.com/b', windowId: 2, lastAccessed: 20 },
    ])
    const m = await loaded()
    await m.recordFields()
    expect(update).toHaveBeenCalledWith(3, { active: true })
    expect(focus).toHaveBeenCalledWith(2, { focused: true })
    expect(send).toHaveBeenCalledWith(3, { type: 'record:start', templateId: 't1' })
    expect(m.error.value).toBeNull()
  })

  it('without a matching tab it asks to open the app first', async () => {
    const { send } = mockTabs([{ id: 1, url: 'https://shop.example.com/x', windowId: 1 }])
    const m = await loaded()
    await m.recordFields()
    expect(m.error.value?.message).toBe('Öffne zuerst die Seite der App.')
    expect(send).not.toHaveBeenCalled()
  })
})
