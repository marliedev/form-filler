import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { browser } from 'wxt/browser'
import { matchApp } from '../fill/appMatch'
import { dispatchFill, startRecording } from '../fill/dispatch'
import { clearBadge, getLastReport } from '../fill/lastReport'
import type { FillMode } from '../fill/messages'
import type { FillReport } from '../fill/runFill'
import type { AppDef, Template } from '../model/types'
import { createId } from '../model/id'
import { clearDatasetsForTab } from '../storage/datasetStore'
import { deleteApp, getPrefs, listApps, listTemplates, saveApp, saveTemplate, setPrefs } from '../storage/repository'
import { toUserError, type UserError } from './userError'

export interface PopupState {
  tabId: Ref<number | null>
  url: Ref<string | null>
  /** Only http(s) pages can be scripted; browser-internal pages cannot. */
  pageSupported: ComputedRef<boolean>
  suggestedPattern: ComputedRef<string>
  app: Ref<AppDef | null>
  /** True when `app` was recognized from the URL, false when chosen manually. */
  detected: Ref<boolean>
  apps: Ref<AppDef[]>
  templates: Ref<Template[]>
  mode: Ref<FillMode>
  report: Ref<FillReport | null>
  busy: Ref<boolean>
  error: Ref<UserError | null>
  /** Short confirmation for the live status line. */
  notice: Ref<string>
  /** The detected app's URL patterns lack the granted host permission (e.g. prompt was closed). */
  permissionMissing: Ref<boolean>
  load(): Promise<void>
  setMode(mode: FillMode): Promise<void>
  fill(templateId: string): Promise<void>
  newDataset(): Promise<void>
  chooseApp(id: string): Promise<void>
  /** Resolves to true when the app was created and the permission granted. */
  createAppForCurrentPage(name: string, pattern?: string): Promise<boolean>
  grantPermission(): Promise<void>
  /** Resolves to true when the template was saved (recording may still have failed). */
  newTemplate(name: string): Promise<boolean>
  record(templateId: string): Promise<void>
  openManage(): Promise<void>
}

function originPattern(url: string | null): string {
  if (url === null) return ''
  try {
    const { protocol, origin } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? `${origin}/*` : ''
  } catch {
    return ''
  }
}

const INVALID_PATTERN = 'Das URL-Muster ist ungültig, z. B. https://app.example.com/*'

export function usePopup(): PopupState {
  const tabId = ref<number | null>(null)
  const url = ref<string | null>(null)
  const app = ref<AppDef | null>(null)
  const detected = ref(false)
  const apps = ref<AppDef[]>([])
  const templates = ref<Template[]>([])
  const mode = ref<FillMode>('all')
  const report = ref<FillReport | null>(null)
  const busy = ref(false)
  const error = ref<UserError | null>(null)
  const notice = ref('')
  const permissionMissing = ref(false)

  const suggestedPattern = computed(() => originPattern(url.value))
  const pageSupported = computed(() => suggestedPattern.value !== '')

  function resetStatus(): void {
    error.value = null
    notice.value = ''
  }

  async function run(fallback: string, action: () => Promise<void>): Promise<void> {
    // A second click while a run is in flight would start a parallel fill on the same page.
    if (busy.value) return
    busy.value = true
    resetStatus()
    try {
      await action()
    } catch (e) {
      error.value = toUserError(e, fallback)
    } finally {
      busy.value = false
    }
  }

  async function hasPermission(patterns: string[]): Promise<boolean> {
    try {
      return await browser.permissions.contains({ origins: patterns })
    } catch {
      // Patterns that are no valid match patterns cannot be checked; do not nag about them.
      return true
    }
  }

  async function selectApp(next: AppDef | null, isDetected: boolean): Promise<void> {
    app.value = next
    detected.value = isDetected
    templates.value = next ? await listTemplates(next.id) : []
    // Only a detected app relies on its own host permission; a manual pick on a foreign page uses activeTab.
    permissionMissing.value = next !== null && isDetected && !(await hasPermission(next.urlPatterns))
  }

  async function load(): Promise<void> {
    try {
      await loadState()
    } catch (e) {
      error.value = toUserError(e, 'Popup konnte nicht geladen werden.')
    }
  }

  async function loadState(): Promise<void> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    tabId.value = tab?.id ?? null
    url.value = tab?.url ?? null
    const [allApps, prefs] = await Promise.all([listApps(), getPrefs()])
    apps.value = allApps
    mode.value = prefs.mode
    const match = url.value === null ? null : matchApp(url.value, allApps)
    await selectApp(match, match !== null)
    if (tabId.value !== null) {
      report.value = await getLastReport(tabId.value)
      if (report.value?.error !== undefined) error.value = toUserError(report.value.error, 'Befüllen fehlgeschlagen.')
    }
  }

  async function setMode(next: FillMode): Promise<void> {
    mode.value = next
    await setPrefs({ mode: next })
  }

  async function fill(templateId: string): Promise<void> {
    const id = tabId.value
    if (id === null || busy.value) return
    report.value = null
    await run('Befüllen fehlgeschlagen.', async () => {
      const result = await dispatchFill(id, templateId, mode.value)
      report.value = result
      if (result.error !== undefined) error.value = toUserError(result.error, 'Befüllen fehlgeschlagen.')
    })
  }

  async function newDataset(): Promise<void> {
    const id = tabId.value
    if (id === null) return
    await run('Datensatz konnte nicht zurückgesetzt werden.', async () => {
      await clearDatasetsForTab(id)
      await clearBadge(id)
      report.value = null
      notice.value = 'Neuer Datensatz – beim nächsten Füllen werden neue Daten erzeugt.'
    })
  }

  async function chooseApp(id: string): Promise<void> {
    resetStatus()
    try {
      await selectApp(apps.value.find((a) => a.id === id) ?? null, false)
    } catch (e) {
      error.value = toUserError(e, 'App konnte nicht geladen werden.')
    }
  }

  /**
   * `permissions.request` is called before the first await so the click's user gesture still counts.
   * The app is saved while the prompt is open because Chrome may close the popup meanwhile and the
   * promise then never settles; an explicit denial removes it again.
   */
  async function createAppForCurrentPage(name: string, pattern = suggestedPattern.value): Promise<boolean> {
    const trimmed = name.trim()
    const origin = pattern.trim()
    if (busy.value) return false
    resetStatus()
    if (trimmed === '') {
      error.value = { message: 'Bitte einen Namen eingeben.' }
      return false
    }
    if (origin === '') {
      error.value = { message: 'Bitte ein URL-Muster eingeben.' }
      return false
    }
    busy.value = true
    let pending: Promise<boolean>
    try {
      pending = browser.permissions.request({ origins: [origin] })
    } catch (e) {
      busy.value = false
      error.value = toUserError(e, INVALID_PATTERN)
      return false
    }
    const created: AppDef = { id: createId(), name: trimmed, urlPatterns: [origin] }
    try {
      await saveApp(created)
      let granted: boolean
      try {
        granted = await pending
      } catch (e) {
        await deleteApp(created.id)
        error.value = toUserError(e, INVALID_PATTERN)
        return false
      }
      if (!granted) {
        await deleteApp(created.id)
        error.value = { message: 'Ohne Berechtigung für diese Adresse kann die App nicht angelegt werden.' }
        return false
      }
      apps.value = await listApps()
      await selectApp(created, url.value !== null && matchApp(url.value, [created]) !== null)
      notice.value = `App „${trimmed}“ angelegt.`
      return true
    } catch (e) {
      error.value = toUserError(e, 'App konnte nicht gespeichert werden.')
      return false
    } finally {
      busy.value = false
    }
  }

  async function grantPermission(): Promise<void> {
    const current = app.value
    if (current === null || busy.value) return
    // Same user-gesture rule as above: request first, everything else afterwards.
    let pending: Promise<boolean>
    try {
      pending = browser.permissions.request({ origins: current.urlPatterns })
    } catch (e) {
      error.value = toUserError(e, INVALID_PATTERN)
      return
    }
    await run('Berechtigung konnte nicht angefragt werden.', async () => {
      const granted = await pending
      permissionMissing.value = !granted
      if (granted) notice.value = 'Berechtigung erteilt.'
      else error.value = { message: 'Berechtigung wurde nicht erteilt.' }
    })
  }

  async function startRecordingIn(tab: number, templateId: string): Promise<void> {
    await startRecording(tab, templateId)
    notice.value = 'Aufnahme gestartet – Felder auf der Seite anklicken.'
  }

  async function record(templateId: string): Promise<void> {
    const id = tabId.value
    if (id === null) return
    await run('Aufnahme konnte nicht gestartet werden.', () => startRecordingIn(id, templateId))
  }

  async function newTemplate(name: string): Promise<boolean> {
    const trimmed = name.trim()
    const current = app.value
    const tab = tabId.value
    if (busy.value) return false
    resetStatus()
    if (trimmed === '') {
      error.value = { message: 'Bitte einen Namen eingeben.' }
      return false
    }
    if (current === null || tab === null) return false
    let saved = false
    await run('Aufnahme konnte nicht gestartet werden.', async () => {
      const template: Template = { id: createId(), appId: current.id, name: trimmed, process: null, fields: [], lastMissing: [] }
      try {
        await saveTemplate(template)
        templates.value = await listTemplates(current.id)
      } catch (e) {
        error.value = toUserError(e, 'Vorlage konnte nicht gespeichert werden.')
        return
      }
      saved = true
      await startRecordingIn(tab, template.id)
    })
    return saved
  }

  async function openManage(): Promise<void> {
    await browser.tabs.create({ url: browser.runtime.getURL('/manage.html') })
  }

  return {
    tabId, url, pageSupported, suggestedPattern, app, detected, apps, templates, mode, report, busy, error, notice, permissionMissing,
    load, setMode, fill, newDataset, chooseApp, createAppForCurrentPage, grantPermission, newTemplate, record, openManage,
  }
}
