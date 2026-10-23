import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { describeElement, displayLabel, findElement, isRequired, type FormControl } from '../dom/locator'
import { suggestDataType } from '../dom/suggest'
import { DATA_TYPES, slotKindFor, type DataTypeGroup, type DataTypeMeta, type SlotKind } from '../generators/catalog'
import type { ControlKind, DataTypeConfig, FieldLocator, FieldRule, Template } from '../model/types'
import { createId } from '../model/id'
import { getTemplate, saveTemplate } from '../storage/repository'

export interface PendingCapture {
  el: FormControl
  /** A copy; editing it does not touch `fields` until `accept`. */
  rule: FieldRule
  /** The suggestion for the element, so switching back to its type restores the suggested options. */
  suggestion: DataTypeConfig
  isNew: boolean
  /** The rule's locator does not lead back to this element, so filling will most likely not find it. */
  unlocatable: boolean
}

export interface Recorder {
  fields: Ref<FieldRule[]>
  pending: Ref<PendingCapture | null>
  dirty: ComputedRef<boolean>
  /** Opens `pending` for a form control; false (and no change) for anything unsupported. */
  capture(el: Element): boolean
  /** Inserts or replaces (by id) the rule and closes the popover. */
  accept(rule: FieldRule): void
  /** Closes the popover without changes. */
  dismiss(): void
  remove(fieldId: string): void
  save(): Promise<void>
  /** Drops all unsaved changes; writes nothing. */
  cancel(): void
}

export interface TypeGroup {
  group: DataTypeGroup
  types: DataTypeMeta[]
}

const LOCATOR_KEYS = ['kind', 'name', 'id', 'label', 'ariaLabel', 'placeholder', 'inputType'] as const satisfies readonly (keyof FieldLocator)[]

/** Field rules are plain JSON; unlike structuredClone this also copes with Vue's reactive proxies. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function sameLocator(a: FieldLocator, b: FieldLocator): boolean {
  return LOCATOR_KEYS.every((key) => a[key] === b[key])
}

function isNativeRadio(el: Element): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === 'radio'
}

/** Whether `locator` finds `el` again; for native radios any radio of the same group counts. */
export function isLocatable(root: ParentNode, locator: FieldLocator, el: FormControl): boolean {
  const found = findElement(root, locator)
  if (found.status !== 'found') return false
  if (found.el === el) return true
  return isNativeRadio(el) && isNativeRadio(found.el) && el.name !== '' && found.el.name === el.name && found.el.form === el.form
}

function isSupported(el: Element): el is FormControl {
  try {
    describeElement(el as FormControl)
    return true
  } catch {
    return false
  }
}

/**
 * Maps an event target to the control a field rule describes: custom radios and inner
 * radios of an ARIA group resolve to the group, parts of an ARIA combobox to the combobox.
 */
export function resolveControl(target: Element): FormControl | null {
  const host = target.closest('[role="radiogroup"], [role="combobox"]')
  if (host && host !== target && isSupported(host)) return host
  return isSupported(target) ? target : null
}

export function slotSequence(kind: SlotKind, index: number): string {
  return kind === 'person' ? String(index + 1) : String.fromCharCode(65 + index)
}

export function nextSlot(kind: SlotKind, used: readonly string[]): string {
  for (let i = 0; ; i++) {
    const slot = slotSequence(kind, i)
    if (!used.includes(slot)) return slot
  }
}

function usedSlots(fields: readonly FieldRule[], kind: SlotKind): string[] {
  return fields.filter((f) => slotKindFor(f.config) === kind && f.slot !== null).map((f) => f.slot as string)
}

/** Slots a field of `kind` may pick: the default slot plus all in use, and the next free one for "neu". */
export function slotChoices(fields: readonly FieldRule[], kind: SlotKind): { existing: string[]; next: string } {
  const used = usedSlots(fields, kind)
  const existing = [...new Set([slotSequence(kind, 0), ...used])].sort((a, b) =>
    a.length - b.length || a.localeCompare(b),
  )
  return { existing, next: nextSlot(kind, existing) }
}

/** Keeps `current` when it fits the type's slot family, else the slot of the last field of that family. */
export function slotFor(config: DataTypeConfig, fields: readonly FieldRule[], current: string | null = null): string | null {
  const kind = slotKindFor(config)
  if (kind === null) return null
  const fits = kind === 'person' ? /^\d+$/ : /^[A-Z]+$/
  if (current !== null && fits.test(current)) return current
  return usedSlots(fields, kind).at(-1) ?? slotSequence(kind, 0)
}

const DEFAULT_CONFIGS: Partial<Record<DataTypeConfig['type'], DataTypeConfig>> = {
  birthDate: { type: 'birthDate', minAge: 18 },
  date: { type: 'date', range: 'past' },
  number: { type: 'number', min: 1, max: 100 },
  fixed: { type: 'fixed', value: '' },
  choice: { type: 'choice', mode: 'random', values: [] },
  checkbox: { type: 'checkbox', checked: true },
  list: { type: 'list', values: [] },
  pattern: { type: 'pattern', pattern: '' },
}

/** Config for a newly picked type: a candidate of that type (original rule, suggestion) or the type's defaults. */
export function configFor(type: DataTypeConfig['type'], candidates: readonly DataTypeConfig[]): DataTypeConfig {
  const match = candidates.find((c) => c.type === type)
  if (match) return clone(match)
  const defaults = DEFAULT_CONFIGS[type]
  return defaults ? clone(defaults) : ({ type } as DataTypeConfig)
}

/** Types sensible for `kind`, grouped in catalog order; 'Steuerung' and the current type are always offered. */
export function typeGroups(kind: ControlKind, current?: DataTypeConfig['type']): TypeGroup[] {
  const groups: TypeGroup[] = []
  for (const meta of DATA_TYPES) {
    const offered = meta.group === 'Steuerung' || meta.controls.includes(kind) || meta.type === current
    if (!offered) continue
    const group = groups.find((g) => g.group === meta.group)
    if (group) group.types.push(meta)
    else groups.push({ group: meta.group, types: [meta] })
  }
  return groups
}

/** One value per line; blank lines and surrounding whitespace are dropped. */
export function parseLines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '')
}

export function useRecorder(template: Template, root: ParentNode = document): Recorder {
  const fields = ref<FieldRule[]>(clone(template.fields))
  const pending = ref<PendingCapture | null>(null)
  /** Serialized field list as last saved; dirty means the current list differs from it. */
  const savedState = ref(JSON.stringify(template.fields))
  const dirty = computed(() => JSON.stringify(fields.value) !== savedState.value)

  function existingFor(el: FormControl, loc: FieldLocator): FieldRule | undefined {
    return fields.value.find((f) => {
      if (sameLocator(f.locator, loc)) return true
      const found = findElement(root, f.locator)
      return found.status === 'found' && found.el === el
    })
  }

  function capture(target: Element): boolean {
    const el = resolveControl(target)
    if (!el) return false
    const locator = describeElement(el)
    const suggestion = suggestDataType(el)
    const existing = existingFor(el, locator)
    if (existing) {
      pending.value = { el, rule: clone(existing), suggestion, isNew: false, unlocatable: !isLocatable(root, existing.locator, el) }
      return true
    }
    const rule: FieldRule = {
      id: createId(),
      label: displayLabel(el) || locator.id || 'Feld',
      locator,
      config: suggestion,
      slot: slotFor(suggestion, fields.value),
      required: isRequired(el),
      appendRunId: false,
    }
    pending.value = { el, rule, suggestion: clone(suggestion), isNew: true, unlocatable: !isLocatable(root, locator, el) }
    return true
  }

  function accept(rule: FieldRule): void {
    const copy = clone(rule)
    const index = fields.value.findIndex((f) => f.id === copy.id)
    fields.value = index === -1 ? [...fields.value, copy] : fields.value.map((f, i) => (i === index ? copy : f))
    pending.value = null
  }

  function dismiss(): void {
    pending.value = null
  }

  function remove(fieldId: string): void {
    const next = fields.value.filter((f) => f.id !== fieldId)
    if (next.length === fields.value.length) return
    fields.value = next
  }

  async function save(): Promise<void> {
    // Re-read so edits made elsewhere meanwhile (name, process, lastMissing) are not overwritten.
    const latest = (await getTemplate(template.id)) ?? template
    const ids = new Set(fields.value.map((f) => f.id))
    await saveTemplate({
      ...latest,
      fields: clone(fields.value),
      lastMissing: latest.lastMissing.filter((id) => ids.has(id)),
    })
    savedState.value = JSON.stringify(fields.value)
  }

  function cancel(): void {
    fields.value = clone(template.fields)
    pending.value = null
  }

  return { fields, pending, dirty, capture, accept, dismiss, remove, save, cancel }
}
