import type { Faker } from '@faker-js/faker'
import { fillElement, nextFrame } from '../dom/fill'
import { findElement, type FormControl } from '../dom/locator'
import type { Dataset } from '../generators/dataset'
import { applyRunId, resolveValue, type FieldValue } from '../generators/resolve'
import type { FieldRule, Template } from '../model/types'
import { validateConfig } from '../model/validateConfig'
import type { FillMode } from './messages'

export type { ContentMessage, FillMode } from './messages'

export interface FieldReport {
  fieldId: string
  label: string
  status: 'filled' | 'skipped' | 'missing' | 'ambiguous' | 'failed'
  detail?: string
}

export interface FillReport {
  templateId: string
  filled: number
  total: number
  fields: FieldReport[]
  /** Set when the whole run could not start (e.g. invalid message); `fields` is then empty. */
  error?: string
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** -1 (the DOM default) means no limit. */
function maxLengthOf(el: FormControl): number | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.maxLength >= 0 ? el.maxLength : null
  }
  return null
}

async function fillField(root: ParentNode, rule: FieldRule, ds: Dataset, f: Faker): Promise<FieldReport> {
  const base = { fieldId: rule.id, label: rule.label }
  // Incomplete options (e.g. an empty list or fixed value) must surface as a problem, not as filled/skipped.
  const invalid = validateConfig(rule.config)
  if (invalid) return { ...base, status: 'failed', detail: `Optionen unvollständig: ${invalid.message}` }
  try {
    // The run id is appended here, not in resolveValue, so it can honor the element's maxlength.
    let value: FieldValue = resolveValue({ ...rule, appendRunId: false }, ds, f)
    if (value.kind === 'skip') return { ...base, status: 'skipped', detail: 'Leer lassen' }

    const found = findElement(root, rule.locator)
    if (found.status === 'missing') return { ...base, status: 'missing', detail: 'Feld nicht gefunden' }
    if (found.status === 'ambiguous') {
      return { ...base, status: 'ambiguous', detail: `${found.count} passende Felder gefunden` }
    }

    if (rule.appendRunId && value.kind === 'text') {
      value = { kind: 'text', value: applyRunId(value.value, ds.runId, maxLengthOf(found.el)) }
    }
    const outcome = await fillElement(found.el, value, rule.locator.kind, () => f.number.float({ min: 0, max: 0.999999 }))
    return outcome.status === 'filled'
      ? { ...base, status: 'filled' }
      : { ...base, status: 'failed', detail: outcome.reason }
  } catch (e) {
    return { ...base, status: 'failed', detail: errorMessage(e) }
  }
}

/**
 * Fills the template's fields in order, waiting a frame between fields so that
 * conditionally rendered fields (e.g. `v-if`) exist before they are looked up.
 * Every field ends up in the report; skipped fields do not count towards `total`.
 */
export async function runFill(root: ParentNode, t: Template, ds: Dataset, mode: FillMode, f: Faker): Promise<FillReport> {
  const fields: FieldReport[] = []
  let processed = 0
  for (const rule of t.fields) {
    if (mode === 'required' && !rule.required) {
      fields.push({ fieldId: rule.id, label: rule.label, status: 'skipped', detail: 'Optional' })
      continue
    }
    if (processed > 0) await nextFrame()
    processed++
    fields.push(await fillField(root, rule, ds, f))
  }
  return {
    templateId: t.id,
    filled: fields.filter((r) => r.status === 'filled').length,
    total: fields.filter((r) => r.status !== 'skipped').length,
    fields,
  }
}
