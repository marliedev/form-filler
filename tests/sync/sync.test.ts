import { describe, expect, it } from 'vitest'
import { buildExport } from '../../src/model/schema'
import { stripAppSource } from '../../src/model/source'
import type { AppDef, Template } from '../../src/model/types'
import { SourceError } from '../../src/sync/fetchSource'
import { fingerprintOf } from '../../src/sync/planSync'
import { syncApp } from '../../src/sync/sync'

const SOURCE = 'https://team.example.com/templates.json'
const fileCrm: AppDef = { id: 'file-crm', name: 'CRM (Team)', urlPatterns: ['https://crm.example.com/*'] }
const fileShop: AppDef = { id: 'file-shop', name: 'Shop (Team)', urlPatterns: ['https://shop.example.com/*'] }

function tpl(id: string, appId: string, name: string): Template {
  return { id, appId, name, process: null, fields: [], lastMissing: [] }
}
const kunde = tpl('ft1', 'file-crm', 'Kunde')
const kontakt = tpl('ft2', 'file-crm', 'Kontakt')
const bestellung = tpl('ft3', 'file-shop', 'Bestellung')

/** A fetch stand-in serving the given export file. */
function serving(apps: AppDef[], templates: Template[]): typeof fetch {
  const body = buildExport(apps, templates)
  return async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => body }) as unknown as Response
}

const crm: AppDef = { id: 'crm', name: 'Kunden CRM', urlPatterns: ['https://crm.example.com/*'], source: { url: SOURCE, appId: null } }

describe('syncApp', () => {
  it('maps the app by URL pattern on the first sync, stores the mapping and creates the templates', async () => {
    const result = await syncApp(crm, [], serving([fileShop, fileCrm], [kunde, bestellung, kontakt]))
    expect(result.app).toEqual({ ...crm, source: { url: SOURCE, appId: 'file-crm' } })
    expect(result.summary).toEqual({ created: 2, updated: 0, copied: 0, removed: 0 })
    expect(result.templates.map((t) => [t.appId, t.name, t.source?.templateId])).toEqual([['crm', 'Kunde', 'ft1'], ['crm', 'Kontakt', 'ft2']])
    expect(result.templates.map((t) => t.id)).not.toContain('ft1')
  })

  it('maps the only app in the file when no pattern matches', async () => {
    const other: AppDef = { ...crm, urlPatterns: ['https://staging.example.com/*'] }
    const result = await syncApp(other, [], serving([fileCrm], [kunde]))
    expect(result.app.source?.appId).toBe('file-crm')
  })

  it('uses the stored mapping even when the patterns do not match any more', async () => {
    const mapped: AppDef = { ...crm, urlPatterns: ['https://shop.example.com/*'], source: { url: SOURCE, appId: 'file-crm' } }
    const result = await syncApp(mapped, [], serving([fileShop, fileCrm], [kunde, bestellung]))
    expect(result.app.source?.appId).toBe('file-crm')
    expect(result.templates.map((t) => t.name)).toEqual(['Kunde'])
  })

  it('refuses when no app can be mapped and names the apps of the file', async () => {
    const other: AppDef = { ...crm, urlPatterns: ['https://staging.example.com/*'] }
    await expect(syncApp(other, [], serving([fileCrm, fileShop], [kunde, bestellung]))).rejects.toThrow(
      new SourceError('Keine passende App in der Datei: CRM (Team), Shop (Team).'),
    )
  })

  it('refuses when the mapped app is missing from the file', async () => {
    const mapped: AppDef = { ...crm, source: { url: SOURCE, appId: 'file-crm' } }
    await expect(syncApp(mapped, [], serving([fileShop], [bestellung]))).rejects.toThrow(
      new SourceError('Die Quelle enthält die zugeordnete App nicht mehr (Kennung file-crm). Quelle prüfen; nichts geändert.'),
    )
  })

  it('refuses when the mapped app has no templates in the file', async () => {
    await expect(syncApp(crm, [], serving([fileCrm], []))).rejects.toThrow(
      new SourceError('Die Quelle enthält keine Vorlagen für diese App; nichts geändert.'),
    )
  })

  it('refuses an app without a source', async () => {
    await expect(syncApp(stripAppSource(crm), [], serving([fileCrm], [kunde]))).rejects.toThrow(new SourceError('Für diese App ist keine Vorlagen-Quelle eingetragen.'))
  })

  it('keeps local templates, replaces synced ones and copies local changes', async () => {
    const synced: Template = { ...kunde, id: 'l1', appId: 'crm', source: { templateId: 'ft1', fingerprint: fingerprintOf(kunde) } }
    const edited: Template = { ...synced, id: 'l2', name: 'Kunde (meins)', source: { templateId: 'ft2', fingerprint: fingerprintOf(kontakt) } }
    const mine = tpl('l3', 'crm', 'Eigene')
    const newKunde = { ...kunde, name: 'Kunde v2' }
    const result = await syncApp(crm, [synced, edited, mine], serving([fileCrm], [newKunde, kontakt]))
    expect(result.summary).toEqual({ created: 0, updated: 2, copied: 1, removed: 0 })
    expect(result.templates.map((t) => [t.id === 'l1' || t.id === 'l2' || t.id === 'l3' ? t.id : 'new', t.name])).toEqual([
      ['l1', 'Kunde v2'],
      ['l2', 'Kontakt'],
      ['new', 'Kunde (meins) (lokal)'],
      ['l3', 'Eigene'],
    ])
  })
})
