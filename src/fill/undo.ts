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
  // Tag check instead of instanceof: a select inside a frame belongs to another realm.
  if (el.localName !== 'select') return false
  const select = el as HTMLSelectElement
  const index = Array.from(select.options).findIndex((o) => o.value === value)
  select.selectedIndex = index
  fire(select, 'input')
  fire(select, 'change')
  return select.value === value || (index === -1 && select.selectedIndex === -1)
}

/** Writes the state before the run back; false when the kind cannot show that state again. */
async function restore(entry: RunEntry, ownership: Ownership): Promise<boolean> {
  const { el, kind, key, before } = entry
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
      if (before === '' || before === ownership.firstSeen(el, key, before)) return false
      return (await fillElement(el, { kind: 'text', value: before }, kind)).status === 'filled'
    default:
      return (await fillElement(el, { kind: 'text', value: before }, kind)).status === 'filled'
  }
}

/**
 * Puts the fields of the last run back to their state before it, last field first so that fields
 * which depend on an earlier one (a section a checkbox reveals) are still there when their turn
 * comes. Fields the user changed since (state differs from what was written), fields that left the
 * page and fields whose old state cannot be shown again stay and are named in `kept`, in form order.
 */
export async function undoLastRun(ownership: Ownership): Promise<UndoResponse> {
  const entries = ownership.lastRun()
  if (entries.length === 0) return { ok: false, error: NOTHING_TO_UNDO }
  let restored = 0
  const keptAt: number[] = []
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!
    const untouched = entry.el.isConnected && currentState(entry.el, entry.kind) === entry.written
    if (untouched && (await restore(entry, ownership))) {
      ownership.restored(entry)
      restored++
    } else {
      keptAt.unshift(i)
    }
  }
  ownership.clearRun()
  return { ok: true, restored, kept: keptAt.map((i) => entries[i]!.label) }
}
