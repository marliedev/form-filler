import type { ControlKind, FieldLocator } from '../model/types'

/** HTMLElement covers `[role=combobox]` and `[role=radiogroup]` hosts. */
export type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLElement

export type FindResult =
  | { status: 'found'; el: FormControl }
  | { status: 'missing' }
  | { status: 'ambiguous'; count: number }

const CANDIDATE_SELECTOR = 'input, select, textarea, [role="combobox"], [role="radiogroup"]'
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

function textOfIds(doc: Document, ids: string | null): string {
  if (!ids) return ''
  return ids
    .split(/\s+/)
    .map((id) => doc.getElementById(id)?.textContent ?? '')
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
  const doc = el.ownerDocument
  if (isNativeRadio(el)) {
    const legend = el.closest('fieldset')?.querySelector(':scope > legend')
    if (legend?.textContent?.trim()) return legend.textContent
    const group = el.closest('[role="radiogroup"]')
    if (group) return textOfIds(doc, group.getAttribute('aria-labelledby')) || (group.getAttribute('aria-label') ?? '')
    return ''
  }
  const id = el.getAttribute('id')
  if (id) {
    const forLabel = Array.from(doc.querySelectorAll('label')).find((l) => l.getAttribute('for') === id)
    if (forLabel) return labelText(forLabel)
  }
  const wrapping = el.closest('label')
  if (wrapping) return labelText(wrapping)
  const labelledBy = textOfIds(doc, el.getAttribute('aria-labelledby'))
  if (labelledBy) return labelledBy
  // ARIA widget hosts (custom radio groups, comboboxes) cannot have a <label>; their
  // aria-label is their visible group label, so it must count like one for re-finding.
  const role = el.getAttribute('role')
  if (role === 'radiogroup' || role === 'combobox') return el.getAttribute('aria-label') ?? ''
  return ''
}

function attr(el: Element, name: string): string {
  return (el.getAttribute(name) ?? '').trim()
}

/** An ARIA radiogroup has no name of its own; it takes the one of the native radios it wraps. */
function nameOf(el: Element): string {
  const own = attr(el, 'name')
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
  const ariaLabel = normalizeLabel(attr(el, 'aria-label'))
  const placeholder = normalizeLabel(attr(el, 'placeholder'))
  if (name) locator.name = name
  if (id) locator.id = id
  if (label) locator.label = label
  if (ariaLabel) locator.ariaLabel = ariaLabel
  if (placeholder) locator.placeholder = placeholder
  if (el.tagName.toLowerCase() === 'input' && kind !== 'radiogroup') {
    locator.inputType = (el.getAttribute('type') ?? 'text').toLowerCase()
  }
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
  const sources = [rawLabel(el), attr(el, 'aria-label'), attr(el, 'placeholder'), nameOf(el)]
  for (const source of sources) {
    const text = displayText(source)
    if (text) return text
  }
  return ''
}

export function isVisible(el: Element): boolean {
  if (el.closest('[hidden]')) return false
  const view = el.ownerDocument.defaultView
  if (!view) return true
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (view.getComputedStyle(node).display === 'none') return false
  }
  return view.getComputedStyle(el).visibility !== 'hidden'
}

function score(el: Element, loc: FieldLocator): number {
  let total = 0
  if (loc.name !== undefined && nameOf(el) === loc.name) total += 4
  if (loc.id !== undefined && !(isNativeRadio(el)) && attr(el, 'id') === loc.id) total += 3
  if (loc.label !== undefined && normalizeLabel(rawLabel(el)) === normalizeLabel(loc.label)) total += 3
  if (loc.ariaLabel !== undefined && normalizeLabel(attr(el, 'aria-label')) === normalizeLabel(loc.ariaLabel)) total += 2
  if (loc.placeholder !== undefined && normalizeLabel(attr(el, 'placeholder')) === normalizeLabel(loc.placeholder)) total += 1
  return total
}

export function findElement(root: ParentNode, loc: FieldLocator): FindResult {
  // Radio names are only unique per form, so groups are tracked per form owner.
  const seenRadioGroups = new Map<HTMLFormElement | null, Set<string>>()
  const candidates: FormControl[] = []
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR))) {
    if (kindOf(el) !== loc.kind || !isVisible(el)) continue
    if (isNativeRadio(el)) {
      // An ARIA radiogroup wrapper is the group; its inner radios are not candidates.
      if (el.closest('[role="radiogroup"]')) continue
      if (el.name) {
        // Only the first visible radio represents its group.
        const names = seenRadioGroups.get(el.form) ?? new Set<string>()
        seenRadioGroups.set(el.form, names)
        if (names.has(el.name)) continue
        names.add(el.name)
      }
    }
    candidates.push(el)
  }

  let best = 0
  let top: FormControl[] = []
  for (const el of candidates) {
    const s = score(el, loc)
    if (s < MIN_SCORE || s < best) continue
    if (s > best) {
      best = s
      top = []
    }
    top.push(el)
  }
  const [only] = top
  if (!only) return { status: 'missing' }
  if (top.length > 1) return { status: 'ambiguous', count: top.length }
  return { status: 'found', el: only }
}

export function isRequired(el: FormControl): boolean {
  if ('required' in el && (el as HTMLInputElement).required === true) return true
  if (el.getAttribute('aria-required') === 'true') return true
  return rawLabel(el).trim().endsWith('*')
}
