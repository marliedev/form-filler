import type { Faker } from '@faker-js/faker'
import { currentState, fillElement, nextFrame } from '../dom/fill'
import { findElement, type FormControl } from '../dom/locator'
import { locatorKey, pageOwnership, type Ownership } from './ownership'
import type { Dataset } from '../generators/dataset'
import { applyRunId, resolveValue, type FieldValue } from '../generators/resolve'
import type { ControlKind, FieldRule, Template } from '../model/types'
import { validateConfig } from '../model/validateConfig'
import type { FillMode } from './messages'

export type { ContentMessage, FillMode } from './messages'

export interface FieldReport {
  fieldId: string
  label: string
  status: 'filled' | 'skipped' | 'missing' | 'ambiguous' | 'failed' | 'kept'
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
  // Tag check instead of instanceof: elements inside a frame belong to another realm.
  if (el.localName === 'input' || el.localName === 'textarea') {
    const { maxLength } = el as HTMLInputElement
    return maxLength >= 0 ? maxLength : null
  }
  return null
}

const CHOICE_KINDS: ReadonlySet<ControlKind> = new Set(['select', 'radiogroup', 'checkbox', 'combobox'])

/**
 * Fillable: empty, or what Form Filler wrote last; anything else is someone's input. Choice controls
 * cannot be emptied by hand, so what they showed at first contact counts as the page's preset and is
 * fillable too, however the page made it (HTML or script). Text the page preset stays, like typed text.
 */
function isFillable(el: FormControl, rule: FieldRule, ownership: Ownership): boolean {
  const kind = rule.locator.kind
  const key = locatorKey(rule.locator)
  const state = currentState(el, kind)
  // Recorded before the empty check: an empty combobox at first contact must not learn a later choice as its preset.
  const preset = CHOICE_KINDS.has(kind) ? ownership.firstSeen(el, key, state) : ''
  return state === '' || state === preset || ownership.isOwn(el, key, state)
}

async function fillField(root: ParentNode, rule: FieldRule, ds: Dataset, f: Faker, ownership: Ownership): Promise<FieldReport> {
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

    if (!isFillable(found.el, rule, ownership)) return { ...base, status: 'kept', detail: 'Bereits ausgefüllt' }

    if (rule.appendRunId && value.kind === 'text') {
      value = { kind: 'text', value: applyRunId(value.value, ds.runId, maxLengthOf(found.el)) }
    }
    const before = currentState(found.el, rule.locator.kind)
    const outcome = await fillElement(found.el, value, rule.locator.kind, () => f.number.float({ min: 0, max: 0.999999 }))
    if (outcome.status !== 'filled') return { ...base, status: 'failed', detail: outcome.reason }
    ownership.record({
      el: found.el,
      fieldId: rule.id,
      label: rule.label,
      kind: rule.locator.kind,
      key: locatorKey(rule.locator),
      before,
      written: currentState(found.el, rule.locator.kind),
    })
    return { ...base, status: 'filled' }
  } catch (e) {
    return { ...base, status: 'failed', detail: errorMessage(e) }
  }
}

/**
 * Fills the template's fields in order, waiting a frame between fields so that
 * conditionally rendered fields (e.g. `v-if`) exist before they are looked up.
 * Every field ends up in the report; skipped fields do not count towards `total`.
 */
export async function runFill(
  root: ParentNode,
  t: Template,
  ds: Dataset,
  mode: FillMode,
  f: Faker,
  ownership: Ownership = pageOwnership(),
): Promise<FillReport> {
  const fields: FieldReport[] = []
  let processed = 0
  ownership.beginRun()
  for (const rule of t.fields) {
    if (mode === 'required' && !rule.required) {
      fields.push({ fieldId: rule.id, label: rule.label, status: 'skipped', detail: 'Optional' })
      continue
    }
    if (processed > 0) await nextFrame()
    processed++
    fields.push(await fillField(root, rule, ds, f, ownership))
  }
  return {
    templateId: t.id,
    filled: fields.filter((r) => r.status === 'filled').length,
    total: fields.filter((r) => r.status !== 'skipped').length,
    fields,
  }
}
