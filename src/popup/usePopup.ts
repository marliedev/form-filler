import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { browser } from 'wxt/browser'
import { matchApp } from '../fill/appMatch'
import { dispatchFill, quickFill as runQuickFill, startRecording, undoLastRun } from '../fill/dispatch'
import { clearBadge, getLastReport } from '../fill/lastReport'
import type { FillMode } from '../fill/messages'
import type { FillReport } from '../fill/runFill'
import type { Dataset } from '../generators/dataset'
import type { AppDef, Template } from '../model/types'
import { createId } from '../model/id'
import { clearDatasetsForTab, getLatestDataset } from '../storage/datasetStore'
import { clearQuickRun, getQuickRun, type QuickRun } from '../storage/quickRunStore'
import { deleteApp, getPrefs, listApps, listTemplates, saveApp, saveTemplate, setPrefs } from '../storage/repository'
import { samePage } from './samePage'
import { toUserError, type UserError } from './userError'

export interface PopupState {
  tabId: Ref<number | null>
  url: Ref<string | null>
  /** Title of the active tab; prefills template names after a quick fill. */
  title: Ref<string>
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
  /** Test data of the tab as shown in the popup; null before the first fill. */
  dataset: Ref<Dataset | null>
  /** Last quick fill of the tab, only while the tab still shows the page it ran on. */
  quickRun: Ref<QuickRun | null>
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
  /** Fills the page without a template; the run can then be saved as one. */
  quickFill(): Promise<void>
  /** The last report has filled fields, so there is a run to take back. */
  canUndo: ComputedRef<boolean>
  /** Puts the last run on the page back and tells what could not be restored. */
  undo(): Promise<void>
  /** Saves the quick run as template of the current app; resolves to true when stored. */
  saveQuickTemplate(name: string): Promise<boolean>
  chooseApp(id: string): Promise<void>
  /** Resolves to true when the app was created and the permission granted. */
  createAppForCurrentPage(name: string, pattern?: string, templateName?: string): Promise<boolean>
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
  const title = ref('')
  const app = ref<AppDef | null>(null)
  const detected = ref(false)
  const apps = ref<AppDef[]>([])
  const templates = ref<Template[]>([])
  const mode = ref<FillMode>('all')
  const report = ref<FillReport | null>(null)
  const dataset = ref<Dataset | null>(null)
  const quickRun = ref<QuickRun | null>(null)
  const busy = ref(false)
  const error = ref<UserError | null>(null)
  const notice = ref('')
  const permissionMissing = ref(false)

  const suggestedPattern = computed(() => originPattern(url.value))
  const pageSupported = computed(() => suggestedPattern.value !== '')
  const canUndo = computed(() => (report.value?.filled ?? 0) > 0)

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
    title.value = tab?.title ?? ''
    const [allApps, prefs] = await Promise.all([listApps(), getPrefs()])
    apps.value = allApps
    mode.value = prefs.mode
    const match = url.value === null ? null : matchApp(url.value, allApps)
    await selectApp(match, match !== null)
    if (tabId.value !== null) {
      dataset.value = await getLatestDataset(tabId.value)
      quickRun.value = await loadQuickRun(tabId.value)
      report.value = await getLastReport(tabId.value)
      if (report.value?.error !== undefined) error.value = toUserError(report.value.error, 'Befüllen fehlgeschlagen.')
    }
  }

  /** A template saved from the run keeps the run's field ids, which is how a finished offer is recognized. */
  function alreadySaved(run: QuickRun): boolean {
    const ids = run.fields.map((f) => f.id).join('\n')
    return templates.value.some((t) => t.fields.map((f) => f.id).join('\n') === ids)
  }

  /** The tab's last quick run, but only on the page it ran on and only until it became a template. */
  async function loadQuickRun(tab: number): Promise<QuickRun | null> {
    const stored = await getQuickRun(tab)
    if (stored === null || url.value === null || !samePage(stored.url, url.value)) return null
    if (alreadySaved(stored)) {
      await clearQuickRun(tab)
      return null
    }
    return stored
  }

  function quickTemplate(appId: string, name: string, quick: QuickRun): Template {
    // Problem fields are marked as missing so the manage tab shows right away what to check.
    return { id: createId(), appId, name, process: null, fields: quick.fields, lastMissing: quick.problems }
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
      try {
        const result = await dispatchFill(id, templateId, mode.value)
        report.value = result
        if (result.error !== undefined) error.value = toUserError(result.error, 'Befüllen fehlgeschlagen.')
      } finally {
        // Even a failed run may have created the tab's dataset; show whatever exists now.
        dataset.value = await getLatestDataset(id)
      }
    })
  }

  async function quickFill(): Promise<void> {
    const id = tabId.value
    if (id === null || busy.value) return
    report.value = null
    await run('Schnellfüllen fehlgeschlagen.', async () => {
      try {
        const result = await runQuickFill(id, mode.value, { url: url.value ?? '', title: title.value })
        report.value = result
        if (result.error !== undefined) error.value = toUserError(result.error, 'Schnellfüllen fehlgeschlagen.')
      } finally {
        dataset.value = await getLatestDataset(id)
        quickRun.value = await loadQuickRun(id)
      }
    })
  }

  async function undo(): Promise<void> {
    const id = tabId.value
    if (id === null || busy.value) return
    await run('Rückgängig fehlgeschlagen.', async () => {
      const result = await undoLastRun(id)
      report.value = null
      if (!result.ok) {
        notice.value = result.error
        return
      }
      const kept = result.kept.length > 0 ? ` · nicht zurückgesetzt: ${result.kept.join(', ')}` : ''
      notice.value = `Letzter Lauf zurückgenommen · ${result.restored} Felder${kept}`
    })
  }

  async function saveQuickTemplate(name: string): Promise<boolean> {
    const trimmed = name.trim()
    const current = app.value
    const quick = quickRun.value
    const tab = tabId.value
    if (busy.value || current === null || quick === null || tab === null) return false
    resetStatus()
    if (trimmed === '') {
      error.value = { message: 'Bitte einen Namen eingeben.' }
      return false
    }
    let saved = false
    await run('Vorlage konnte nicht gespeichert werden.', async () => {
      await saveTemplate(quickTemplate(current.id, trimmed, quick))
      templates.value = await listTemplates(current.id)
      await clearQuickRun(tab)
      quickRun.value = null
      notice.value = `Vorlage „${trimmed}“ gespeichert – Felder im Pflege-Tab prüfen.`
      saved = true
    })
    return saved
  }

  async function newDataset(): Promise<void> {
    const id = tabId.value
    if (id === null) return
    await run('Datensatz konnte nicht zurückgesetzt werden.', async () => {
      await clearDatasetsForTab(id)
      await clearBadge(id)
      report.value = null
      dataset.value = null
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
  async function createAppForCurrentPage(name: string, pattern = suggestedPattern.value, templateName = ''): Promise<boolean> {
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
    const quick = quickRun.value
    const template = templateName.trim()
    const withTemplate = quick !== null && template !== ''
    try {
      await saveApp(created)
      // Saved before the prompt answers for the same reason as the app; a denial deletes both.
      if (withTemplate) await saveTemplate(quickTemplate(created.id, template, quick))
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
      if (withTemplate) {
        if (tabId.value !== null) await clearQuickRun(tabId.value)
        quickRun.value = null
        notice.value = `App „${trimmed}“ und Vorlage „${template}“ angelegt.`
      } else {
        notice.value = `App „${trimmed}“ angelegt.`
      }
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
    tabId, url, title, pageSupported, suggestedPattern, app, detected, apps, templates, mode, report, dataset, quickRun, busy, error, notice, permissionMissing,
    canUndo,
    load, setMode, fill, quickFill, undo, saveQuickTemplate, newDataset, chooseApp, createAppForCurrentPage, grantPermission, newTemplate, record, openManage,
  }
}
