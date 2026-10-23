import { currentState, fillElement } from '../dom/fill'
import type { FormControl } from '../dom/locator'
import type { UndoResponse } from './messages'
import type { Ownership, RunEntry } from './ownership'

export const NOTHING_TO_UNDO = 'Nichts zum Zurücknehmen – die Seite wurde seit dem letzten Lauf neu geladen.'

function fire(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true, composed: true }))
}

/** Selects are restored directly: the placeholder option (empty value) is never offered by the filler. */
function restoreSelect(el: FormControl, value: string): boolean {
  if (!(el instanceof HTMLSelectElement)) return false
  const index = Array.from(el.options).findIndex((o) => o.value === value)
  el.selectedIndex = index
  fire(el, 'input')
  fire(el, 'change')
  return el.value === value || (index === -1 && el.selectedIndex === -1)
}

/** Writes the state before the run back; false when the kind cannot show that state again. */
async function restore(entry: RunEntry, ownership: Ownership): Promise<boolean> {
  const { el, kind, before } = entry
  switch (kind) {
    case 'select':
      return restoreSelect(el, before)
    case 'checkbox':
      return (await fillElement(el, { kind: 'checkbox', checked: before === 'on' }, kind)).status === 'filled'
    case 'radiogroup':
      // A radio group cannot be unselected by clicking.
      if (before === '') return false
      return (await fillElement(el, { kind: 'choice', mode: 'fixed', values: [before] }, kind)).status === 'filled'
    case 'combobox':
      // The placeholder is not an option; a real previous value is chosen again.
      if (before === '' || before === ownership.placeholderOf(el, before)) return false
      return (await fillElement(el, { kind: 'text', value: before }, kind)).status === 'filled'
    default:
      return (await fillElement(el, { kind: 'text', value: before }, kind)).status === 'filled'
  }
}

/**
 * Puts the fields of the last run back to their state before it. Fields the user changed since
 * (state differs from what was written) and fields whose old state cannot be shown again stay
 * and are named in `kept`.
 */
export async function undoLastRun(ownership: Ownership): Promise<UndoResponse> {
  const entries = ownership.lastRun()
  if (entries.length === 0) return { ok: false, error: NOTHING_TO_UNDO }
  let restored = 0
  const kept: string[] = []
  for (const entry of entries) {
    const untouched = currentState(entry.el, entry.kind) === entry.written
    if (untouched && (await restore(entry, ownership))) restored++
    else kept.push(entry.label)
  }
  ownership.clearRun()
  return { ok: true, restored, kept }
}
