import { slotKindFor, type SlotKind } from '../generators/catalog'
import { createId } from '../model/id'
import type { ControlKind, DataTypeConfig, FieldRule } from '../model/types'
import { slotSequence } from '../recorder/useRecorder'
import { deepClosest } from './deep'
import { describeElement, displayLabel, isRequired, listControls, type FormControl } from './locator'
import { suggestDataType } from './suggest'

/** Page chrome whose fields are never part of the form a tester wants filled, plus the recorder's own overlay. */
const EXCLUDED_ANCESTORS = 'header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"], [role="search"], form-filler-recorder'

function isSearch(el: FormControl): boolean {
  return (el.getAttribute('type') ?? '').toLowerCase() === 'search' || el.getAttribute('role') === 'searchbox'
}

function isInert(el: FormControl): boolean {
  // Tag checks instead of instanceof: elements inside a frame belong to another realm.
  const tag = el.localName
  if (tag === 'input' || tag === 'textarea') return (el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly
  if (tag === 'select') return (el as HTMLSelectElement).disabled
  return false
}

const CHOICE_KINDS: readonly ControlKind[] = ['select', 'radiogroup', 'combobox']
/** Types whose values usually match the options of a choice control; other suggestions would never match. */
const CHOICE_FRIENDLY: ReadonlySet<DataTypeConfig['type']> = new Set(['salutation', 'country', 'legalForm', 'choice', 'fixed', 'list', 'checkbox', 'empty'])
const RANDOM_CHOICE: DataTypeConfig = { type: 'choice', mode: 'random', values: [] }

/**
 * The recorder may suggest types a human completes afterwards (a list without values, an industry
 * text for a select). A quick fill has no human in between, so such suggestions become something
 * that fills: a random option on choice controls, free text elsewhere.
 */
function fillableConfig(kind: ControlKind, config: DataTypeConfig): DataTypeConfig {
  const isChoice = CHOICE_KINDS.includes(kind)
  if (config.type === 'list' && config.values.length === 0) return isChoice ? { ...RANDOM_CHOICE } : { type: 'text' }
  if (isChoice && !CHOICE_FRIENDLY.has(config.type)) return { ...RANDOM_CHOICE }
  return config
}

/**
 * Pure: copies the rules with slots assigned in document order. The first person is 1, the first
 * address A; when a type of the same family repeats within the current slot (a second "PLZ", a
 * second "Vorname"), the next slot begins and the following fields of that family belong to it.
 * A type directly followed by itself ("E-Mail", "E-Mail wiederholen") stays in the slot.
 */
export function assignSlots(rules: readonly FieldRule[]): FieldRule[] {
  const index: Record<SlotKind, number> = { person: 0, address: 0 }
  const used: Record<SlotKind, Set<string>> = { person: new Set(), address: new Set() }
  const last: Record<SlotKind, string | null> = { person: null, address: null }
  return rules.map((rule) => {
    const kind = slotKindFor(rule.config)
    if (kind === null) return { ...rule, slot: null }
    const type = rule.config.type
    if (used[kind].has(type) && last[kind] !== type) {
      index[kind] += 1
      used[kind].clear()
    }
    used[kind].add(type)
    last[kind] = type
    return { ...rule, slot: slotSequence(kind, index[kind]) }
  })
}

/** Builds the rules the recorder would suggest for every fillable form control of the page. */
export function scanControls(root: ParentNode): FieldRule[] {
  const rules = listControls(root)
    .filter((el) => deepClosest(el, EXCLUDED_ANCESTORS) === null && !isSearch(el) && !isInert(el))
    .map((el): FieldRule => {
      const locator = describeElement(el)
      return {
        id: createId(),
        label: displayLabel(el) || locator.name || 'Feld',
        locator,
        config: fillableConfig(locator.kind, suggestDataType(el)),
        slot: null,
        required: isRequired(el),
        appendRunId: false,
      }
    })
  return assignSlots(rules)
}
