import type { AppDef, Template } from './types'

/** The template as a local one: the sync marker is neither exported nor copied. */
export function stripTemplateSource(t: Template): Template {
  const { id, appId, name, process, fields, lastMissing } = t
  return { id, appId, name, process, fields, lastMissing }
}

/** Keeps the file id but ends the sync relation: used when the app's address changes. */
export function detachTemplateSource(t: Template): Template {
  return t.source === undefined ? t : { ...t, source: { ...t.source, detached: true } }
}

/** Whether the template follows its app's source (a detached marker only remembers the file id). */
export function isSynced(t: Template): boolean {
  return t.source !== undefined && t.source.detached !== true
}

/** The app without its source: an exported file must not carry the exporter's address. */
export function stripAppSource(a: AppDef): AppDef {
  const { id, name, urlPatterns } = a
  return { id, name, urlPatterns }
}
