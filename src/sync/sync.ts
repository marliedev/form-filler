/* One app's sync: find the app in the team's file, plan and apply. Storage stays with the caller. */
import type { AppDef, ExportFile, Template } from '../model/types'
import { fetchSource, SourceError } from './fetchSource'
import { applyPlan, planSync, type SyncSummary } from './planSync'

export interface SyncResult {
  /** The app with its mapping to the app in the file. */
  app: AppDef
  /** The app's complete new template list. */
  templates: Template[]
  summary: SyncSummary
}

export const NO_SOURCE = 'Für diese App ist keine Vorlagen-Quelle eingetragen.'

/** The app mapped earlier, else the app sharing a URL pattern, else the only app in the file. */
function mapApp(app: AppDef, mappedId: string | null, file: ExportFile): AppDef {
  if (mappedId !== null) {
    const mapped = file.apps.find((a) => a.id === mappedId)
    if (mapped === undefined) {
      throw new SourceError(`Die Quelle enthält die zugeordnete App nicht mehr (Kennung ${mappedId}). Quelle prüfen; nichts geändert.`)
    }
    return mapped
  }
  const byPattern = file.apps.find((a) => a.urlPatterns.some((p) => app.urlPatterns.includes(p)))
  if (byPattern !== undefined) return byPattern
  const only = file.apps.length === 1 ? file.apps[0] : undefined
  if (only !== undefined) return only
  throw new SourceError(`Keine passende App in der Datei: ${file.apps.map((a) => a.name).join(', ') || 'keine'}.`)
}

/** Plans the sync of `app` (with `local`, all its templates) against an already downloaded file. */
export function syncFromFile(app: AppDef, local: readonly Template[], file: ExportFile): SyncResult {
  if (app.source === undefined) throw new SourceError(NO_SOURCE)
  const mapped = mapApp(app, app.source.appId, file)
  const plan = planSync(local, file.templates.filter((t) => t.appId === mapped.id))
  return {
    app: { ...app, source: { url: app.source.url, appId: mapped.id } },
    templates: applyPlan(plan, app.id),
    summary: plan.summary,
  }
}

export async function syncApp(app: AppDef, local: readonly Template[], fetchImpl?: typeof fetch): Promise<SyncResult> {
  if (app.source === undefined) throw new SourceError(NO_SOURCE)
  return syncFromFile(app, local, await fetchSource(app.source.url, fetchImpl))
}
