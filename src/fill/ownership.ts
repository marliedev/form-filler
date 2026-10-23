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
  /** Locator key of the field, see `locatorKey`. */
  key: string
  /** State before the run wrote the field. */
  before: FieldState
  /** State right after writing; the field counts as own while it still shows this. */
  written: FieldState
}

export interface Ownership {
  /** Whether `state` is what Form Filler last wrote into this element, or into a field with the same locator (re-rendered pages). */
  isOwn(el: Element, key: string, state: FieldState): boolean
  /** The state a control showed when Form Filler first met it on this page: the page's own preset, however it was made. */
  firstSeen(el: Element, key: string, state: FieldState): FieldState
  beginRun(): void
  record(entry: RunEntry): void
  /** After undo put the field back: the state before the run is Form Filler's again. */
  restored(entry: RunEntry): void
  lastRun(): readonly RunEntry[]
  clearRun(): void
}

/** Locators are plain data; their JSON identifies a field across re-renders. */
export const locatorKey = (locator: FieldLocator): string => JSON.stringify(locator)

/** A value remembered per element and, for re-rendered pages, per locator key. */
interface Memory {
  get(el: Element, key: string): FieldState | undefined
  set(el: Element, key: string, state: FieldState): void
}

function createMemory(): Memory {
  const byElement = new WeakMap<Element, FieldState>()
  const byKey = new Map<string, FieldState>()
  return {
    get: (el, key) => byElement.get(el) ?? byKey.get(key),
    set(el, key, state) {
      byElement.set(el, state)
      byKey.set(key, state)
    },
  }
}

export function createOwnership(): Ownership {
  const written = createMemory()
  const presets = createMemory()
  let run: RunEntry[] = []
  return {
    isOwn: (el, key, state) => written.get(el, key) === state,
    firstSeen(el, key, state) {
      const known = presets.get(el, key)
      if (known !== undefined) return known
      presets.set(el, key, state)
      return state
    },
    beginRun() {
      run = []
    },
    record(entry) {
      written.set(entry.el, entry.key, entry.written)
      run.push(entry)
    },
    restored(entry) {
      written.set(entry.el, entry.key, entry.before)
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
