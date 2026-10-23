import type { AppDef, Template } from './types'

/** The template as a local one: the sync marker is neither exported nor copied. */
export function stripTemplateSource(t: Template): Template {
  const { id, appId, name, process, fields, lastMissing } = t
  return { id, appId, name, process, fields, lastMissing }
}

/** The app without its source: an exported file must not carry the exporter's address. */
export function stripAppSource(a: AppDef): AppDef {
  const { id, name, urlPatterns } = a
  return { id, name, urlPatterns }
}
