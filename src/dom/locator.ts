import type { ControlKind, FieldLocator } from '../model/types'
import { byId, deepClosest, deepQuerySelectorAll, hostOf, parentOf, rootOf, scopeOf, type Root } from './deep'

/** HTMLElement covers `[role=combobox]` and `[role=radiogroup]` hosts. */
export type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLElement

export type FindResult =
  | { status: 'found'; el: FormControl }
  | { status: 'missing' }
  | { status: 'ambiguous'; count: number }

/** Buttons that open a list of options (Headless UI, Nuxt UI, Radix selects); handled like an ARIA combobox. */
export const LISTBOX_BUTTON_SELECTOR = 'button[aria-haspopup="listbox"], [role="button"][aria-haspopup="listbox"]'
const CANDIDATE_SELECTOR = `input, select, textarea, [role="combobox"], [role="radiogroup"], ${LISTBOX_BUTTON_SELECTOR}`
const IGNORED_INPUT_TYPES = new Set(['button', 'submit', 'reset', 'hidden', 'file', 'image'])
const MIN_SCORE = 3

export function normalizeLabel(text: string): string {
  return text
    .replace(/[\s ]+/g, ' ')
    .trim()
    .replace(/[\s*:]+$/, '')
    .toLowerCase()
}

function kindOf(el: Element): ControlKind | null {
  const role = el.getAttribute('role')
  if (role === 'combobox') return 'combobox'
  if (role === 'radiogroup') return 'radiogroup'
  if (el.matches(LISTBOX_BUTTON_SELECTOR)) return 'combobox'
  const tag = el.tagName.toLowerCase()
  if (tag === 'select') return 'select'
  if (tag === 'textarea') return 'textarea'
  if (tag !== 'input') return null
  const type = (el.getAttribute('type') ?? 'text').toLowerCase()
  if (IGNORED_INPUT_TYPES.has(type)) return null
  if (type === 'checkbox') return 'checkbox'
  if (type === 'radio') return 'radiogroup'
  if (type === 'date') return 'date'
  return 'text'
}

function isNativeRadio(el: Element): el is HTMLInputElement {
  return el.tagName.toLowerCase() === 'input' && (el.getAttribute('type') ?? '').toLowerCase() === 'radio'
}

function textOfIds(root: Root, ids: string | null): string {
  if (!ids) return ''
  return ids
    .split(/\s+/)
    .map((id) => byId(root, id)?.textContent ?? '')
    .join(' ')
}

/** Text of a `<label>` without the text of controls nested inside it (e.g. select options). */
function labelText(label: Element): string {
  const clone = label.cloneNode(true) as Element
  clone.querySelectorAll('input, select, textarea, button').forEach((n) => n.remove())
  return clone.textContent ?? ''
}

/** Raw (not normalized) label text, so `isRequired` can still see a trailing '*'. */
function rawLabel(el: Element): string {
  // Labels and ids are looked up in the element's own tree: a shadow root keeps its own.
  const root = rootOf(el)
  if (isNativeRadio(el)) {
    const legend = el.closest('fieldset')?.querySelector(':scope > legend')
    if (legend?.textContent?.trim()) return legend.textContent
    const group = el.closest('[role="radiogroup"]')
    if (group) return textOfIds(root, group.getAttribute('aria-labelledby')) || (group.getAttribute('aria-label') ?? '')
    return ''
  }
  const id = el.getAttribute('id')
  if (id) {
    const forLabel = Array.from(root.querySelectorAll('label')).find((l) => l.getAttribute('for') === id)
    if (forLabel) return labelText(forLabel)
  }
  const wrapping = el.closest('label')
  if (wrapping) return labelText(wrapping)
  const labelledBy = textOfIds(root, el.getAttribute('aria-labelledby'))
  if (labelledBy) return labelledBy
  // ARIA widget hosts (custom radio groups, comboboxes) cannot have a <label>; their
  // aria-label is their visible group label, so it must count like one for re-finding.
  const role = el.getAttribute('role')
  if (role === 'radiogroup' || role === 'combobox') return el.getAttribute('aria-label') ?? ''
  return componentLabel(el) || hostLabel(el)
}

/**
 * Web components carry the label at the host: either a main-document <label for="host-id">
 * or a `label` attribute (Ionic, Vaadin, UI5 and the like).
 */
function hostLabel(el: Element): string {
  const host = hostOf(el)
  if (!host) return ''
  if (host.id) {
    const forLabel = Array.from(rootOf(host).querySelectorAll('label')).find((l) => l.getAttribute('for') === host.id)
    if (forLabel) return labelText(forLabel)
  }
  return host.getAttribute('label') ?? ''
}

const COMPONENT_DEPTH = 4

/**
 * Component libraries often render `<label>` next to the input without `for`. Walk up the
 * wrappers and take an unlinked label, but stop as soon as a wrapper holds another control,
 * so a field never borrows the label of a neighbour.
 */
function componentLabel(el: Element): string {
  let node = el.parentElement
  for (let depth = 0; node && depth < COMPONENT_DEPTH; depth++, node = node.parentElement) {
    const controls = Array.from(node.querySelectorAll(CANDIDATE_SELECTOR)).filter((c) => kindOf(c) !== null)
    if (controls.some((c) => c !== el)) return ''
    const label = Array.from(node.querySelectorAll('label')).find((l) => !l.hasAttribute('for'))
    if (label) return labelText(label)
  }
  return ''
}

function attr(el: Element, name: string): string {
  return (el.getAttribute(name) ?? '').trim()
}

/** The element's own attribute, else the same attribute of its shadow host (web components keep name, aria-label, placeholder, autocomplete there). */
export function effectiveAttr(el: Element, name: string): string {
  const own = attr(el, name)
  if (own) return own
  const host = hostOf(el)
  return host ? attr(host, name) : ''
}

/** An ARIA radiogroup has no name of its own; it takes the one of the native radios it wraps. */
function nameOf(el: Element): string {
  const own = effectiveAttr(el, 'name')
  if (own || el.getAttribute('role') !== 'radiogroup') return own
  const inner = el.querySelector('input[type="radio"][name]')
  return inner ? attr(inner, 'name') : ''
}

/** Throws for elements that are not a supported form control. */
export function describeElement(el: FormControl): FieldLocator {
  const kind = kindOf(el)
  if (!kind) throw new Error(`Unsupported form control <${el.tagName.toLowerCase()}>`)
  const locator: FieldLocator = { kind }
  const name = nameOf(el)
  const id = kind === 'radiogroup' && isNativeRadio(el) ? '' : attr(el, 'id')
  const label = normalizeLabel(rawLabel(el))
  const ariaLabel = normalizeLabel(effectiveAttr(el, 'aria-label'))
  const placeholder = normalizeLabel(effectiveAttr(el, 'placeholder'))
  if (name) locator.name = name
  if (id) locator.id = id
  if (label) locator.label = label
  if (ariaLabel) locator.ariaLabel = ariaLabel
  if (placeholder) locator.placeholder = placeholder
  if (el.tagName.toLowerCase() === 'input' && kind !== 'radiogroup') {
    locator.inputType = (el.getAttribute('type') ?? 'text').toLowerCase()
  }
  // Omitted for the main document, so existing templates and exports keep their shape.
  const scope = scopeOf(el)
  if (scope.length > 0) locator.scope = scope
  return locator
}

function displayText(text: string): string {
  return text
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
    .replace(/[\s*:]+$/, '')
}

/**
 * Human-readable name of a control in its original case (label, aria-label, placeholder, name),
 * unlike the normalized locator values which only serve as matching keys. '' if there is none.
 */
export function displayLabel(el: FormControl): string {
  const sources = [rawLabel(el), effectiveAttr(el, 'aria-label'), effectiveAttr(el, 'placeholder'), nameOf(el)]
  for (const source of sources) {
    const text = displayText(source)
    if (text) return text
  }
  return ''
}

export function isVisible(el: Element): boolean {
  // Climbs through shadow hosts and frame elements: a field in a hidden frame is hidden too.
  for (let node: Element | null = el; node; node = parentOf(node)) {
    if (node.hasAttribute('hidden')) return false
    const view = node.ownerDocument.defaultView
    if (view && view.getComputedStyle(node).display === 'none') return false
  }
  const view = el.ownerDocument.defaultView
  return !view || view.getComputedStyle(el).visibility !== 'hidden'
}

function sameScope(wanted: string[] | undefined, actual: string[]): boolean {
  return (wanted ?? []).join('\n') === actual.join('\n')
}

function score(el: Element, loc: FieldLocator): number {
  let total = 0
  if (loc.name !== undefined && nameOf(el) === loc.name) total += 4
  if (loc.id !== undefined && !(isNativeRadio(el)) && attr(el, 'id') === loc.id) total += 3
  if (loc.label !== undefined && normalizeLabel(rawLabel(el)) === normalizeLabel(loc.label)) total += 3
  if (loc.ariaLabel !== undefined && normalizeLabel(effectiveAttr(el, 'aria-label')) === normalizeLabel(loc.ariaLabel)) total += 2
  if (loc.placeholder !== undefined && normalizeLabel(effectiveAttr(el, 'placeholder')) === normalizeLabel(loc.placeholder)) total += 1
  return total
}

/** The recorder's own overlay lives in this host; its controls are never page fields. */
const OVERLAY_HOST = 'form-filler-recorder'

/** Visible supported controls in document order; a native radio group is represented by its first radio. */
export function listControls(root: ParentNode): FormControl[] {
  // Radio names are only unique per form and per tree (a frame or shadow root has its own), so
  // groups are tracked per tree and form owner.
  const seenRadioGroups = new Map<Root, Map<HTMLFormElement | null, Set<string>>>()
  const controls: FormControl[] = []
  for (const el of deepQuerySelectorAll(root, CANDIDATE_SELECTOR) as HTMLElement[]) {
    if (kindOf(el) === null || !isVisible(el) || deepClosest(el, OVERLAY_HOST) !== null) continue
    if (isNativeRadio(el)) {
      // An ARIA radiogroup wrapper is the group; its inner radios are not candidates.
      if (el.closest('[role="radiogroup"]')) continue
      if (el.name) {
        // Only the first visible radio represents its group.
        const tree = rootOf(el)
        const forms = seenRadioGroups.get(tree) ?? new Map<HTMLFormElement | null, Set<string>>()
        seenRadioGroups.set(tree, forms)
        const names = forms.get(el.form) ?? new Set<string>()
        forms.set(el.form, names)
        if (names.has(el.name)) continue
        names.add(el.name)
      }
    }
    controls.push(el)
  }
  return controls
}

/**
 * Best match among given candidates (one `listControls` call can serve many locators). Among the
 * candidates that match at all, those in the locator's place (the main document for locators
 * without `scope`) come first: an old template keeps finding its main-document field even when a
 * frame or component holds a twin that matches better, and a field recorded in a frame is found
 * there. Without any candidate in place, the best match anywhere wins.
 */
export function findAmong(candidates: readonly FormControl[], loc: FieldLocator): FindResult {
  const matching = candidates
    .filter((el) => kindOf(el) === loc.kind)
    .map((el) => ({ el, score: score(el, loc) }))
    .filter((m) => m.score >= MIN_SCORE)
  const inPlace = matching.filter((m) => sameScope(loc.scope, scopeOf(m.el)))
  const pool = inPlace.length > 0 ? inPlace : matching
  const best = Math.max(0, ...pool.map((m) => m.score))
  const top = pool.filter((m) => m.score === best).map((m) => m.el)
  const [only] = top
  if (!only) return { status: 'missing' }
  if (top.length > 1) return { status: 'ambiguous', count: top.length }
  return { status: 'found', el: only }
}

export function findElement(root: ParentNode, loc: FieldLocator): FindResult {
  return findAmong(listControls(root), loc)
}

export function isRequired(el: FormControl): boolean {
  if ('required' in el && (el as HTMLInputElement).required === true) return true
  // Listbox buttons carry `required` as a plain attribute; buttons have no such property.
  if (el.hasAttribute('required') || el.getAttribute('aria-required') === 'true') return true
  const host = hostOf(el)
  if (host && (host.hasAttribute('required') || host.getAttribute('aria-required') === 'true')) return true
  return rawLabel(el).trim().endsWith('*')
}
