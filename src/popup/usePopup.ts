import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { browser } from 'wxt/browser'
import { matchApp } from '../fill/appMatch'
import { dispatchFill, startRecording } from '../fill/dispatch'
import { clearBadge, getLastReport } from '../fill/lastReport'
import type { FillMode } from '../fill/messages'
import type { FillReport } from '../fill/runFill'
import type { AppDef, Template } from '../model/types'
import { clearDatasetsForTab } from '../storage/datasetStore'
import { getPrefs, listApps, listTemplates, saveApp, saveTemplate, setPrefs } from '../storage/repository'
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
  load(): Promise<void>
  setMode(mode: FillMode): Promise<void>
  fill(templateId: string): Promise<void>
  newDataset(): Promise<void>
  chooseApp(id: string): Promise<void>
  createAppForCurrentPage(name: string, pattern?: string): Promise<void>
  newTemplate(name: string): Promise<void>
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

  async function selectApp(next: AppDef | null, isDetected: boolean): Promise<void> {
    app.value = next
    detected.value = isDetected
    templates.value = next ? await listTemplates(next.id) : []
  }

  async function load(): Promise<void> {
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
    await selectApp(apps.value.find((a) => a.id === id) ?? null, false)
  }

  async function createAppForCurrentPage(name: string, pattern = suggestedPattern.value): Promise<void> {
    const trimmed = name.trim()
    const origin = pattern.trim()
    resetStatus()
    if (trimmed === '') {
      error.value = { message: 'Bitte einen Namen eingeben.' }
      return
    }
    if (origin === '') {
      error.value = { message: 'Bitte ein URL-Muster eingeben.' }
      return
    }
    busy.value = true
    try {
      // Must be the first await: Chrome only shows the permission prompt during the user gesture.
      const granted = await browser.permissions.request({ origins: [origin] })
      if (!granted) {
        error.value = { message: 'Ohne Berechtigung für diese Adresse kann die App nicht angelegt werden.' }
        return
      }
      const created: AppDef = { id: crypto.randomUUID(), name: trimmed, urlPatterns: [origin] }
      await saveApp(created)
      apps.value = await listApps()
      await selectApp(created, url.value !== null && matchApp(url.value, [created]) !== null)
      notice.value = `App „${trimmed}“ angelegt.`
    } catch (e) {
      error.value = toUserError(e, 'Das URL-Muster ist ungültig, z. B. https://app.example.com/*')
    } finally {
      busy.value = false
    }
  }

  async function record(templateId: string): Promise<void> {
    const id = tabId.value
    if (id === null) return
    await run('Aufnahme konnte nicht gestartet werden.', async () => {
      await startRecording(id, templateId)
      notice.value = 'Aufnahme gestartet – Felder auf der Seite anklicken.'
    })
  }

  async function newTemplate(name: string): Promise<void> {
    const trimmed = name.trim()
    const current = app.value
    resetStatus()
    if (trimmed === '') {
      error.value = { message: 'Bitte einen Namen eingeben.' }
      return
    }
    if (current === null) return
    const template: Template = { id: crypto.randomUUID(), appId: current.id, name: trimmed, process: null, fields: [], lastMissing: [] }
    await saveTemplate(template)
    templates.value = await listTemplates(current.id)
    await record(template.id)
  }

  async function openManage(): Promise<void> {
    await browser.tabs.create({ url: browser.runtime.getURL('/manage.html') })
  }

  return {
    tabId, url, pageSupported, suggestedPattern, app, detected, apps, templates, mode, report, busy, error, notice,
    load, setMode, fill, newDataset, chooseApp, createAppForCurrentPage, newTemplate, record, openManage,
  }
}
