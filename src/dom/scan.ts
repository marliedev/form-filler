import { slotKindFor, type SlotKind } from '../generators/catalog'
import { createId } from '../model/id'
import type { FieldRule } from '../model/types'
import { slotSequence } from '../recorder/useRecorder'
import { describeElement, displayLabel, isRequired, listControls, type FormControl } from './locator'
import { suggestDataType } from './suggest'

/** Page chrome whose fields are never part of the form a tester wants filled, plus the recorder's own overlay. */
const EXCLUDED_ANCESTORS = 'header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"], [role="search"], form-filler-recorder'

function isSearch(el: FormControl): boolean {
  return (el.getAttribute('type') ?? '').toLowerCase() === 'search' || el.getAttribute('role') === 'searchbox'
}

function isInert(el: FormControl): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.disabled || el.readOnly
  if (el instanceof HTMLSelectElement) return el.disabled
  return false
}

/**
 * Pure: copies the rules with slots assigned in document order. The first person is 1, the first
 * address A; when a type of the same family repeats within the current slot (a second "PLZ", a
 * second "Vorname"), the next slot begins and the following fields of that family belong to it.
 */
export function assignSlots(rules: readonly FieldRule[]): FieldRule[] {
  const index: Record<SlotKind, number> = { person: 0, address: 0 }
  const used: Record<SlotKind, Set<string>> = { person: new Set(), address: new Set() }
  return rules.map((rule) => {
    const kind = slotKindFor(rule.config)
    if (kind === null) return { ...rule, slot: null }
    if (used[kind].has(rule.config.type)) {
      index[kind] += 1
      used[kind].clear()
    }
    used[kind].add(rule.config.type)
    return { ...rule, slot: slotSequence(kind, index[kind]) }
  })
}

/** Builds the rules the recorder would suggest for every fillable form control of the page. */
export function scanControls(root: ParentNode): FieldRule[] {
  const rules = listControls(root)
    .filter((el) => el.closest(EXCLUDED_ANCESTORS) === null && !isSearch(el) && !isInert(el))
    .map((el): FieldRule => {
      const locator = describeElement(el)
      return {
        id: createId(),
        label: displayLabel(el) || locator.name || 'Feld',
        locator,
        config: suggestDataType(el),
        slot: null,
        required: isRequired(el),
        appendRunId: false,
      }
    })
  return assignSlots(rules)
}
