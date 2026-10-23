/* Page memory of what Form Filler wrote. It lives in the content script, so it lasts exactly as
   long as the page: a reload forgets everything, which is what the spec asks for. */
import type { FieldState } from '../dom/fill'
import type { FormControl } from '../dom/locator'
import type { ControlKind, FieldLocator } from '../model/types'

export interface RunEntry {
  el: FormControl
  fieldId: string
  label: string
  kind: ControlKind
  /** State before the run wrote the field. */
  before: FieldState
  /** State right after writing; the field counts as own while it still shows this. */
  written: FieldState
}

export interface Ownership {
  /** Whether `state` is what Form Filler last wrote into this element, or into a field with the same locator (re-rendered pages). */
  isOwn(el: Element, key: string, state: FieldState): boolean
  /** The text an ARIA control showed when Form Filler first met it on this page, i.e. its placeholder. */
  placeholderOf(el: Element, shown: string): string
  beginRun(): void
  record(entry: RunEntry, key: string): void
  lastRun(): readonly RunEntry[]
  clearRun(): void
}

/** Locators are plain data; their JSON identifies a field across re-renders. */
export const locatorKey = (locator: FieldLocator): string => JSON.stringify(locator)

export function createOwnership(): Ownership {
  const byElement = new WeakMap<Element, FieldState>()
  const byKey = new Map<string, FieldState>()
  const placeholders = new WeakMap<Element, string>()
  let run: RunEntry[] = []
  return {
    isOwn: (el, key, state) => byElement.get(el) === state || byKey.get(key) === state,
    placeholderOf(el, shown) {
      const known = placeholders.get(el)
      if (known !== undefined) return known
      placeholders.set(el, shown)
      return shown
    },
    beginRun() {
      run = []
    },
    record(entry, key) {
      byElement.set(entry.el, entry.written)
      byKey.set(key, entry.written)
      run.push(entry)
    },
    lastRun: () => run,
    clearRun() {
      run = []
    },
  }
}

let page: Ownership | null = null

/** One memory per page; created on first use by the content script. */
export function pageOwnership(): Ownership {
  page ??= createOwnership()
  return page
}
