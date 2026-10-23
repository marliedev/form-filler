import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { browser } from 'wxt/browser'
import { matchApp } from '../fill/appMatch'
import { createId } from '../model/id'
import { startRecording } from '../fill/dispatch'
import { buildExport, parseExport } from '../model/schema'
import { detachTemplateSource, stripTemplateSource } from '../model/source'
import type { AppDef, ExportFile, FieldRule, Template } from '../model/types'
import { toUserError, type UserError } from '../popup/userError'
import { slotFor } from '../recorder/useRecorder'
import {
  deleteApp,
  deleteTemplate,
  getPrefs,
  getTemplate,
  importExport,
  listApps,
  listTemplates,
  saveApp as storeApp,
  saveAppWithTemplates,
  saveTemplate,
  setPrefs,
} from '../storage/repository'
import { fetchSource, ONLY_HTTP, SourceError, sourceOrigin } from '../sync/fetchSource'
import { summaryText, type SyncSummary } from '../sync/planSync'
import { NO_SOURCE, syncFromFile } from '../sync/sync'

export type ConflictChoice = 'overwrite' | 'copy'

export interface ExportDownload {
  filename: string
  content: string
}

export interface ManageState {
  apps: Ref<AppDef[]>
  selectedApp: ComputedRef<AppDef | null>
  /** Templates of the selected app. */
  templates: ComputedRef<Template[]>
  selectedTemplate: ComputedRef<Template | null>
  busy: Ref<boolean>
  error: Ref<UserError | null>
  /** Short confirmation for the live status line. */
  notice: Ref<string>
  load(): Promise<void>
  /** Re-reads storage, keeping the selection where it still exists (e.g. after the recorder saved). */
  refresh(): Promise<void>
  selectApp(id: string): void
  selectTemplate(id: string): void
  updateField(id: string, patch: Partial<FieldRule>): Promise<boolean>
  removeField(id: string): Promise<boolean>
  /** `to` is the zero-based target index; out-of-range values are clamped. */
  moveField(id: string, to: number): Promise<boolean>
  /** `sourceUrl` is the address of the team's export file: empty removes the source, undefined leaves it as it is. */
  saveApp(app: AppDef & { sourceUrl?: string }): Promise<boolean>
  removeApp(id: string): Promise<boolean>
  /** Brings the app's templates to the state of its source; false with `error` set means nothing changed. */
  syncApp(id: string): Promise<boolean>
  /** Syncs every app with a source: summaries in `notice`, failures in `error`; one app's failure does not stop the others. */
  syncAll(): Promise<void>
  saveTemplateMeta(patch: Pick<Template, 'name' | 'process'>): Promise<boolean>
  removeTemplate(id: string): Promise<boolean>
  /** Copies a template into the same app (fields with fresh ids, no missing markers) and selects the copy. */
  duplicateTemplate(id: string): Promise<boolean>
  exportAll(): Promise<ExportDownload>
  exportApp(id: string): Promise<ExportDownload>
  /** `onConflict` is only asked when ids collide; null cancels. Resolves to the message shown to the user. */
  importFile(text: string, onConflict: () => Promise<ConflictChoice | null>): Promise<string>
  recordFields(): Promise<void>
}

const INVALID_PATTERN = 'Das URL-Muster ist ungültig, z. B. https://app.example.com/*'

function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'app'
}

/** German count with singular/plural noun, e.g. „1 Vorlage“, „2 Vorlagen“. */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function applyPatch(field: FieldRule, patch: Partial<FieldRule>): FieldRule {
  const next: FieldRule = { ...field, ...patch, id: field.id }
  // A type change moves the field into the slot family of the new type unless a slot was chosen explicitly.
  if (patch.config !== undefined && patch.slot === undefined) next.slot = slotFor(next.config, [], field.slot)
  return next
}

export function useManage(): ManageState {
  const apps = ref<AppDef[]>([])
  const allTemplates = ref<Template[]>([])
  const selectedAppId = ref<string | null>(null)
  const selectedTemplateId = ref<string | null>(null)
  const busy = ref(false)
  const error = ref<UserError | null>(null)
  const notice = ref('')

  const selectedApp = computed(() => apps.value.find((a) => a.id === selectedAppId.value) ?? null)
  const templates = computed(() => allTemplates.value.filter((t) => t.appId === selectedAppId.value))
  const selectedTemplate = computed(() => templates.value.find((t) => t.id === selectedTemplateId.value) ?? null)

  // Each write re-reads storage first; chaining them keeps two quick edits from overwriting each other.
  let queue: Promise<unknown> = Promise.resolve()
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  function resetStatus(): void {
    error.value = null
    notice.value = ''
  }

  function fail(message: string): false {
    error.value = { message }
    return false
  }

  function ensureSelection(): void {
    if (!apps.value.some((a) => a.id === selectedAppId.value)) selectedAppId.value = apps.value[0]?.id ?? null
    if (!templates.value.some((t) => t.id === selectedTemplateId.value)) selectedTemplateId.value = templates.value[0]?.id ?? null
  }

  async function refresh(): Promise<void> {
    const [nextApps, nextTemplates] = await Promise.all([listApps(), listTemplates()])
    apps.value = nextApps
    allTemplates.value = nextTemplates
    ensureSelection()
  }

  async function load(): Promise<void> {
    try {
      await refresh()
    } catch (e) {
      error.value = toUserError(e, 'Vorlagen konnten nicht geladen werden.')
    }
  }

  function selectApp(id: string): void {
    selectedAppId.value = id
    selectedTemplateId.value = null
    ensureSelection()
  }

  function selectTemplate(id: string): void {
    selectedTemplateId.value = id
  }

  function replaceLocal(template: Template): void {
    allTemplates.value = allTemplates.value.map((t) => (t.id === template.id ? template : t))
  }

  /** Applies `change` to the stored (not the displayed) template, so fields written meanwhile elsewhere survive. */
  async function mutateTemplate(fallback: string, change: (t: Template) => Template | string): Promise<boolean> {
    const id = selectedTemplateId.value
    if (id === null) return false
    resetStatus()
    try {
      return await serialized(async () => {
        const latest = await getTemplate(id)
        if (!latest) throw new Error('Vorlage nicht gefunden')
        const next = change(latest)
        if (typeof next === 'string') return fail(next)
        await saveTemplate(next)
        replaceLocal(next)
        return true
      })
    } catch (e) {
      error.value = toUserError(e, fallback)
      return false
    }
  }

  async function updateField(id: string, patch: Partial<FieldRule>): Promise<boolean> {
    const ok = await mutateTemplate('Änderung konnte nicht gespeichert werden.', (t) => {
      if (!t.fields.some((f) => f.id === id)) return 'Das Feld gibt es nicht mehr.'
      return { ...t, fields: t.fields.map((f) => (f.id === id ? applyPatch(f, patch) : f)) }
    })
    if (ok) notice.value = 'Änderung gespeichert.'
    return ok
  }

  async function removeField(id: string): Promise<boolean> {
    let label = ''
    const ok = await mutateTemplate('Feld konnte nicht gelöscht werden.', (t) => {
      label = t.fields.find((f) => f.id === id)?.label ?? ''
      return { ...t, fields: t.fields.filter((f) => f.id !== id), lastMissing: t.lastMissing.filter((m) => m !== id) }
    })
    if (ok) notice.value = `Feld „${label}“ gelöscht.`
    return ok
  }

  async function moveField(id: string, to: number): Promise<boolean> {
    let message = ''
    const ok = await mutateTemplate('Reihenfolge konnte nicht gespeichert werden.', (t) => {
      const moved = t.fields.find((f) => f.id === id)
      if (!moved) return 'Das Feld gibt es nicht mehr.'
      const rest = t.fields.filter((f) => f.id !== id)
      const index = Math.max(0, Math.min(Math.trunc(to), rest.length))
      message = `„${moved.label}“ ist jetzt an Position ${index + 1} von ${t.fields.length}.`
      return { ...t, fields: [...rest.slice(0, index), moved, ...rest.slice(index)] }
    })
    if (ok) notice.value = message
    return ok
  }

  async function saveTemplateMeta(patch: Pick<Template, 'name' | 'process'>): Promise<boolean> {
    const name = patch.name.trim()
    const processName = patch.process?.name.trim() ?? ''
    const step = patch.process?.step ?? 1
    resetStatus()
    if (name === '') return fail('Bitte einen Namen für die Vorlage eingeben.')
    if (processName !== '' && (!Number.isInteger(step) || step < 1)) return fail('Der Schritt muss eine ganze Zahl ab 1 sein.')
    const process = processName === '' ? null : { name: processName, step }
    const ok = await mutateTemplate('Vorlage konnte nicht gespeichert werden.', (t) => ({ ...t, name, process }))
    if (ok) notice.value = `Vorlage „${name}“ gespeichert.`
    return ok
  }

  /** The keyboard shortcut refills the last used template; it must not point to a deleted one. */
  async function forgetLastTemplate(ids: readonly string[]): Promise<void> {
    const { lastTemplateId } = await getPrefs()
    if (lastTemplateId !== null && ids.includes(lastTemplateId)) await setPrefs({ lastTemplateId: null })
  }

  async function removeTemplate(id: string): Promise<boolean> {
    resetStatus()
    const name = allTemplates.value.find((t) => t.id === id)?.name ?? ''
    try {
      await serialized(async () => {
        await deleteTemplate(id)
        await forgetLastTemplate([id])
        await refresh()
      })
      notice.value = `Vorlage „${name}“ gelöscht.`
      return true
    } catch (e) {
      error.value = toUserError(e, 'Vorlage konnte nicht gelöscht werden.')
      return false
    }
  }

  async function duplicateTemplate(id: string): Promise<boolean> {
    resetStatus()
    try {
      const copy = await serialized(async () => {
        const source = await getTemplate(id)
        if (!source) return null
        const created: Template = {
          ...stripTemplateSource(source),
          id: createId(),
          name: `${source.name} (Kopie)`,
          fields: source.fields.map((field) => ({ ...structuredClone(field), id: createId() })),
          lastMissing: [],
        }
        await saveTemplate(created)
        await refresh()
        return created
      })
      if (copy === null) return fail('Vorlage nicht gefunden.')
      selectedTemplateId.value = copy.id
      notice.value = `Vorlage „${copy.name}“ angelegt.`
      return true
    } catch (e) {
      error.value = toUserError(e, 'Vorlage konnte nicht dupliziert werden.')
      return false
    }
  }

  async function removeApp(id: string): Promise<boolean> {
    resetStatus()
    const name = apps.value.find((a) => a.id === id)?.name ?? ''
    try {
      await serialized(async () => {
        const ids = (await listTemplates(id)).map((t) => t.id)
        await deleteApp(id)
        await forgetLastTemplate(ids)
        await refresh()
      })
      notice.value = `App „${name}“ gelöscht.`
      return true
    } catch (e) {
      error.value = toUserError(e, 'App konnte nicht gelöscht werden.')
      return false
    }
  }

  /**
   * `permissions.request` runs before the first await so the click's user gesture still counts.
   * Without the permission for an added pattern or a new source nothing is saved, like when creating the app in the popup.
   */
  async function saveApp(app: AppDef & { sourceUrl?: string }): Promise<boolean> {
    resetStatus()
    const name = app.name.trim()
    const urlPatterns = [...new Set(app.urlPatterns.map((p) => p.trim()).filter((p) => p !== ''))]
    if (name === '') return fail('Bitte einen Namen für die App eingeben.')
    if (urlPatterns.length === 0) return fail('Bitte mindestens ein URL-Muster eingeben.')
    const previous = apps.value.find((a) => a.id === app.id)
    const sourceUrl = app.sourceUrl === undefined ? (previous?.source?.url ?? '') : app.sourceUrl.trim()
    const origin = sourceUrl === '' ? null : sourceOrigin(sourceUrl)
    if (sourceUrl !== '' && origin === null) return fail(ONLY_HTTP)
    const sourceChanged = sourceUrl !== (previous?.source?.url ?? '')
    const added = urlPatterns.filter((p) => !previous?.urlPatterns.includes(p))
    const origins = sourceChanged && origin !== null ? [...added, `${origin}/*`] : added
    let permission: Promise<boolean> = Promise.resolve(true)
    if (origins.length > 0) {
      try {
        permission = browser.permissions.request({ origins })
      } catch (e) {
        error.value = toUserError(e, INVALID_PATTERN)
        return false
      }
    }
    busy.value = true
    try {
      let granted: boolean
      try {
        granted = await permission
      } catch (e) {
        error.value = toUserError(e, INVALID_PATTERN)
        return false
      }
      if (!granted) return fail('Ohne Berechtigung für die neue Adresse wurde nichts geändert.')
      // A new address starts unmapped; the first sync maps it.
      const source = sourceChanged ? (sourceUrl === '' ? undefined : { url: sourceUrl, appId: null }) : previous?.source
      await serialized(async () => {
        const next: AppDef = { id: app.id, name, urlPatterns, ...(source === undefined ? {} : { source }) }
        // A moved or removed source detaches the synced templates: they stay as local ones, and the next sync
        // recognises them by their file id. App and templates go in one write so neither can be left behind.
        if (sourceChanged) await saveAppWithTemplates(next, (await listTemplates(app.id)).map(detachTemplateSource))
        else await storeApp(next)
        await refresh()
      })
      notice.value = `App „${name}“ gespeichert.`
      return true
    } catch (e) {
      error.value = toUserError(e, 'App konnte nicht gespeichert werden.')
      return false
    } finally {
      busy.value = false
    }
  }

  /** Downloads outside the write queue, then plans and writes against the stored state. */
  async function runSync(id: string): Promise<SyncSummary> {
    const known = apps.value.find((a) => a.id === id)
    if (known?.source === undefined) throw new SourceError(NO_SOURCE)
    const file = await fetchSource(known.source.url)
    return serialized(async () => {
      const app = (await listApps()).find((a) => a.id === id)
      if (app === undefined) throw new Error('App nicht gefunden')
      const local = await listTemplates(id)
      const result = syncFromFile(app, local, file)
      await saveAppWithTemplates(result.app, result.templates)
      const kept = new Set(result.templates.map((t) => t.id))
      await forgetLastTemplate(local.filter((t) => !kept.has(t.id)).map((t) => t.id))
      await refresh()
      return result.summary
    })
  }

  function syncError(e: unknown): UserError {
    return e instanceof SourceError ? { message: e.message } : toUserError(e, 'Abgleich fehlgeschlagen.')
  }

  async function syncApp(id: string): Promise<boolean> {
    resetStatus()
    busy.value = true
    try {
      notice.value = summaryText(await runSync(id))
      return true
    } catch (e) {
      error.value = syncError(e)
      return false
    } finally {
      busy.value = false
    }
  }

  async function syncAll(): Promise<void> {
    resetStatus()
    busy.value = true
    const notices: string[] = []
    const failures: string[] = []
    try {
      for (const app of apps.value.filter((a) => a.source !== undefined)) {
        try {
          notices.push(`${app.name} – ${summaryText(await runSync(app.id))}`)
        } catch (e) {
          failures.push(`${app.name}: ${syncError(e).message}`)
        }
      }
      notice.value = notices.join(' · ')
      if (failures.length > 0) error.value = { message: failures.join(' · ') }
    } finally {
      busy.value = false
    }
  }

  async function exportAll(): Promise<ExportDownload> {
    const [allApps, all] = await Promise.all([listApps(), listTemplates()])
    return { filename: `form-filler-export-${isoDate(new Date())}.json`, content: buildExport(allApps, all) }
  }

  async function exportApp(id: string): Promise<ExportDownload> {
    const app = (await listApps()).find((a) => a.id === id)
    if (!app) throw new Error('App nicht gefunden')
    const own = await listTemplates(id)
    return { filename: `form-filler-${slugify(app.name)}-${isoDate(new Date())}.json`, content: buildExport([app], own) }
  }

  async function importFile(text: string, onConflict: () => Promise<ConflictChoice | null>): Promise<string> {
    resetStatus()
    const report = (message: string, isError: boolean): string => {
      if (isError) error.value = { message }
      else notice.value = message
      return message
    }
    const parsed = parseExport(text)
    if (!parsed.ok) return report(parsed.error, true)
    const data: ExportFile = parsed.data
    busy.value = true
    try {
      const [storedApps, storedTemplates] = await Promise.all([listApps(), listTemplates()])
      const knownApps = new Set([...storedApps, ...data.apps].map((a) => a.id))
      if (data.templates.some((t) => !knownApps.has(t.appId))) {
        return report('Ungültige Export-Datei: Sie enthält Vorlagen ohne zugehörige App. Es wurde nichts importiert.', true)
      }
      const appIds = new Set(storedApps.map((a) => a.id))
      const templateIds = new Set(storedTemplates.map((t) => t.id))
      const conflict = data.apps.some((a) => appIds.has(a.id)) || data.templates.some((t) => templateIds.has(t.id))
      const choice = conflict ? await onConflict() : 'overwrite'
      if (choice === null) return report('Import abgebrochen – es wurde nichts geändert.', false)
      const result = await serialized(async () => {
        const counts = await importExport(data, choice)
        await refresh()
        return counts
      })
      return report(`Import abgeschlossen: ${count(result.apps, 'App', 'Apps')}, ${count(result.templates, 'Vorlage', 'Vorlagen')}.`, false)
    } catch (e) {
      const message = toUserError(e, 'Import fehlgeschlagen.').message
      return report(message, true)
    } finally {
      busy.value = false
    }
  }

  async function recordFields(): Promise<void> {
    const app = selectedApp.value
    const template = selectedTemplate.value
    if (app === null || template === null || busy.value) return
    resetStatus()
    busy.value = true
    try {
      const tabs = await browser.tabs.query({})
      const candidates = tabs.filter((t) => t.id !== undefined && t.url !== undefined && matchApp(t.url, [app]) !== null)
      const tab = candidates.reduce<(typeof candidates)[number] | undefined>(
        (best, t) => (best === undefined || (t.lastAccessed ?? 0) > (best.lastAccessed ?? 0) ? t : best),
        undefined,
      )
      if (tab?.id === undefined) {
        error.value = { message: 'Öffne zuerst die Seite der App.' }
        return
      }
      await browser.tabs.update(tab.id, { active: true })
      if (tab.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true })
      await startRecording(tab.id, template.id)
      notice.value = 'Aufnahme gestartet – Felder auf der Seite anklicken und dort speichern.'
    } catch (e) {
      error.value = toUserError(e, 'Aufnahme konnte nicht gestartet werden.')
    } finally {
      busy.value = false
    }
  }

  return {
    apps, selectedApp, templates, selectedTemplate, busy, error, notice,
    load, refresh, selectApp, selectTemplate, updateField, removeField, moveField,
    saveApp, removeApp, syncApp, syncAll, saveTemplateMeta, removeTemplate, duplicateTemplate, exportAll, exportApp, importFile, recordFields,
  }
}
