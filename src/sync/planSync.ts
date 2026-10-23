/* Pure planning of a sync: which local templates of one app change how, given the templates of
   the mapped app in the source file. Nothing here touches storage. */
import { createId } from '../model/id'
import { isSynced, stripTemplateSource } from '../model/source'
import type { Template } from '../model/types'
import { SourceError } from './fetchSource'

export type SyncAction =
  | { kind: 'adopt'; local: Template; source: Template }
  | { kind: 'create'; source: Template }
  | { kind: 'replace'; local: Template; source: Template }
  | { kind: 'copyAndReplace'; local: Template; source: Template }
  | { kind: 'remove'; local: Template }
  | { kind: 'copyAndRemove'; local: Template }
  | { kind: 'unchanged'; local: Template }

export interface SyncSummary {
  created: number
  updated: number
  copied: number
  removed: number
}

export interface SyncPlan {
  actions: SyncAction[]
  summary: SyncSummary
}

export const NO_TEMPLATES = 'Die Quelle enthält keine Vorlagen für diese App; nichts geändert.'

/** The same data with object keys sorted at every level, so the key order in a file does not matter. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonical(record[key])]))
  }
  return value
}

/** Content identity of a template: name, process and fields in order; ids and markers do not count. */
export function fingerprintOf(t: Template): string {
  return JSON.stringify(canonical({ name: t.name, process: t.process, fields: t.fields }))
}

/** A synced template the user edited since the last sync. */
function changedLocally(local: Template): boolean {
  return local.source !== undefined && local.source.fingerprint !== fingerprintOf(local)
}

/** Same content: only the marker is renewed. Different content: the local version survives as a copy. */
function adoptOrCopy(local: Template, source: Template): SyncAction {
  return fingerprintOf(local) === fingerprintOf(source) ? { kind: 'adopt', local, source } : { kind: 'copyAndReplace', local, source }
}

function summarize(actions: readonly SyncAction[]): SyncSummary {
  const summary: SyncSummary = { created: 0, updated: 0, copied: 0, removed: 0 }
  for (const action of actions) {
    switch (action.kind) {
      case 'create':
        summary.created++
        break
      case 'replace':
        summary.updated++
        break
      case 'copyAndReplace':
        summary.updated++
        summary.copied++
        break
      case 'remove':
        summary.removed++
        break
      case 'copyAndRemove':
        summary.copied++
        summary.removed++
        break
      case 'adopt':
      case 'unchanged':
        break
    }
  }
  return summary
}

/**
 * `local`: every template of the local app; `remote`: the templates of the mapped app in the file.
 * Synced templates are matched by the id they carry from the file. Templates without a marker (imported
 * by hand) are matched by their own id, detached ones (address changed) by their old file id; both are
 * adopted or copied but never removed. Local-only templates stay untouched. An empty source is refused:
 * it would wipe the app.
 */
export function planSync(local: readonly Template[], remote: readonly Template[]): SyncPlan {
  if (remote.length === 0) throw new SourceError(NO_TEMPLATES)
  const byId = new Map(remote.map((t) => [t.id, t]))
  const matched = new Set<string>()
  const actions: SyncAction[] = []
  for (const l of local) {
    if (isSynced(l) && l.source !== undefined) {
      const r = byId.get(l.source.templateId)
      if (r === undefined) {
        actions.push(changedLocally(l) ? { kind: 'copyAndRemove', local: l } : { kind: 'remove', local: l })
        continue
      }
      matched.add(r.id)
      // A local edit that equals the new source version (the maintainer's own publish) needs no copy.
      if (changedLocally(l)) actions.push(adoptOrCopy(l, r))
      else if (fingerprintOf(r) !== l.source.fingerprint) actions.push({ kind: 'replace', local: l, source: r })
      else actions.push({ kind: 'unchanged', local: l })
      continue
    }
    const r = byId.get(l.source?.templateId ?? l.id)
    if (r !== undefined && !matched.has(r.id)) {
      matched.add(r.id)
      actions.push(adoptOrCopy(l, r))
      continue
    }
    actions.push({ kind: 'unchanged', local: l })
  }
  for (const r of remote) if (!matched.has(r.id)) actions.push({ kind: 'create', source: r })
  return { actions, summary: summarize(actions) }
}

/** `<name> (lokal)`, then `(lokal 2)`, `(lokal 3)` … until the name is free. */
export function copyName(name: string, taken: readonly string[]): string {
  const first = `${name} (lokal)`
  if (!taken.includes(first)) return first
  for (let n = 2; ; n++) {
    const candidate = `${name} (lokal ${n})`
    if (!taken.includes(candidate)) return candidate
  }
}

export function summaryText(s: SyncSummary): string {
  return `Abgeglichen: ${s.created} neu, ${s.updated} aktualisiert, ${s.copied} lokal geändert (Kopie), ${s.removed} entfernt.`
}

/** Applies a plan and returns the app's new template list, in local order with copies next to their originals. */
export function applyPlan(plan: SyncPlan, appId: string): Template[] {
  const taken = plan.actions.flatMap((a) => [...('local' in a ? [a.local.name] : []), ...('source' in a ? [a.source.name] : [])])
  const fromSource = (source: Template, id: string): Template => ({
    id,
    appId,
    name: source.name,
    process: source.process,
    fields: structuredClone(source.fields),
    lastMissing: [],
    source: { templateId: source.id, fingerprint: fingerprintOf(source) },
  })
  const copyOf = (local: Template): Template => {
    const name = copyName(local.name, taken)
    taken.push(name)
    return { ...stripTemplateSource(local), id: createId(), appId, name }
  }
  const result: Template[] = []
  for (const a of plan.actions) {
    switch (a.kind) {
      case 'unchanged':
        result.push(a.local)
        break
      case 'adopt':
        result.push({ ...a.local, source: { templateId: a.source.id, fingerprint: fingerprintOf(a.source) } })
        break
      case 'create':
        result.push(fromSource(a.source, createId()))
        break
      case 'replace':
        result.push(fromSource(a.source, a.local.id))
        break
      case 'copyAndReplace':
        result.push(fromSource(a.source, a.local.id), copyOf(a.local))
        break
      case 'copyAndRemove':
        result.push(copyOf(a.local))
        break
      case 'remove':
        break
    }
  }
  return result
}
