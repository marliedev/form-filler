import type { FieldValue } from '../generators/resolve'
import type { ControlKind } from '../model/types'
import { isVisible, type FormControl } from './locator'

export type FillOutcome = { status: 'filled'; shown: string } | { status: 'failed'; reason: string }

type Rand = () => number
type Choice = { mode: 'random' | 'subset' | 'fixed'; values: string[] }

interface Option<T extends Element> {
  el: T
  text: string
  value: string
}

const LISTBOX_TIMEOUT_MS = 500
const FRAME_FALLBACK_MS = 50
const TRUE_WORDS = new Set(['ja', 'true', '1', 'an', 'x', 'yes', 'aktiviert', 'checked'])
const FALSE_WORDS = new Set(['nein', 'false', '0', 'aus', 'no', 'deaktiviert', ''])

const filled = (shown: string): FillOutcome => ({ status: 'filled', shown })
const failed = (reason: string): FillOutcome => ({ status: 'failed', reason })

/** Resolves after the next paint so framework re-renders (e.g. `v-if` blocks) are in the DOM. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    // rAF is paused in background tabs; the timeout keeps a fill run from hanging there.
    const timer = setTimeout(resolve, FRAME_FALLBACK_MS)
    if (typeof requestAnimationFrame !== 'function') return
    requestAnimationFrame(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function germanDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

function pick<T>(items: readonly T[], rand: Rand): T | undefined {
  const i = Math.min(items.length - 1, Math.max(0, Math.floor(rand() * items.length)))
  return items[i]
}

function asChoice(v: Exclude<FieldValue, { kind: 'skip' | 'checkbox' }>): Choice {
  if (v.kind === 'choice') return { mode: v.mode, values: v.values }
  return { mode: 'fixed', values: [v.kind === 'date' ? germanDate(v.iso) : v.value] }
}

/** Returns the chosen option, or a German failure reason. */
function choose<T extends Element>(options: Option<T>[], c: Choice, rand: Rand): Option<T> | string {
  if (options.length === 0) return 'Keine auswählbaren Optionen vorhanden'
  const matches = (o: Option<T>, wanted: string) => norm(o.text) === norm(wanted) || norm(o.value) === norm(wanted)
  if (c.mode === 'random') return pick(options, rand) ?? 'Keine auswählbaren Optionen vorhanden'
  if (c.mode === 'fixed') {
    const wanted = c.values[0]
    if (wanted === undefined) return 'Kein Wert für die Auswahl angegeben'
    return options.find((o) => matches(o, wanted)) ?? `Wert „${wanted}“ ist nicht in der Auswahl vorhanden`
  }
  const pool = options.filter((o) => c.values.some((w) => matches(o, w)))
  return pick(pool, rand) ?? `Keiner der Werte „${c.values.join('“, „')}“ ist in der Auswahl vorhanden`
}

function isTag<K extends keyof HTMLElementTagNameMap>(el: Element, tag: K): el is HTMLElementTagNameMap[K] {
  return el.tagName.toLowerCase() === tag
}

function fire(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }))
}

function pointerPress(el: Element): void {
  const init: MouseEventInit = { bubbles: true, cancelable: true, button: 0 }
  el.dispatchEvent(new MouseEvent('mousedown', init))
  el.dispatchEvent(new MouseEvent('mouseup', init))
  el.dispatchEvent(new MouseEvent('click', init))
}

function focusQuietly(el: Element): void {
  if ('focus' in el && typeof el.focus === 'function') (el as HTMLElement).focus({ preventScroll: true })
}

function textToWrite(v: Exclude<FieldValue, { kind: 'skip' | 'checkbox' }>, isoDateInput: boolean, rand: Rand): string | null {
  if (v.kind === 'text') return v.value
  if (v.kind === 'date') return isoDateInput ? v.iso : germanDate(v.iso)
  if (v.mode === 'fixed') return v.values[0] ?? null
  return pick(v.values, rand) ?? null
}

function fillText(el: FormControl, v: Exclude<FieldValue, { kind: 'skip' | 'checkbox' }>, rand: Rand): FillOutcome {
  if (!isTag(el, 'input') && !isTag(el, 'textarea')) return failed('Feld ist kein Texteingabefeld')
  if (el.disabled) return failed('Feld ist deaktiviert')
  if (el.readOnly) return failed('Feld ist schreibgeschützt')
  const isoDateInput = isTag(el, 'input') && el.type === 'date'
  let value = textToWrite(v, isoDateInput, rand)
  if (value === null) return failed('Keine Werte zur Auswahl angegeben')
  // Browsers store line breaks as LF, so CRLF would otherwise never read back equal.
  value = value.replace(/\r\n?/g, '\n')
  // maxlength only limits typing, not programmatic writes; cut here so the page sees what a user could enter.
  if (el.maxLength >= 0) value = value.slice(0, el.maxLength)

  const view = el.ownerDocument.defaultView
  const proto = isTag(el, 'textarea') ? view?.HTMLTextAreaElement.prototype : view?.HTMLInputElement.prototype
  // React and similar libraries shadow `value` on the instance; only the prototype setter updates their tracker.
  const setter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : undefined
  focusQuietly(el)
  if (setter) setter.call(el, value)
  else el.value = value
  fire(el, 'input')
  fire(el, 'change')
  el.blur()
  if (el.value.replace(/\r\n?/g, '\n') !== value) return failed(`Wert „${value}“ wurde vom Feld nicht übernommen`)
  return filled(value)
}

function fillSelect(el: FormControl, choice: Choice, rand: Rand): FillOutcome {
  if (!isTag(el, 'select')) return failed('Feld ist keine Auswahlliste')
  if (el.disabled) return failed('Feld ist deaktiviert')
  const options = Array.from(el.options)
    // An empty value marks the "Bitte wählen" placeholder, which must never count as a choice.
    .filter((o) => !o.disabled && o.value !== '' && !(o.parentElement && isTag(o.parentElement, 'optgroup') && o.parentElement.disabled))
    .map((o) => ({ el: o, text: o.text.trim(), value: o.value }))
  const chosen = choose(options, choice, rand)
  if (typeof chosen === 'string') return failed(chosen)
  focusQuietly(el)
  el.selectedIndex = chosen.el.index
  fire(el, 'input')
  fire(el, 'change')
  el.blur()
  if (el.selectedIndex !== chosen.el.index) return failed(`Option „${chosen.text}“ wurde nicht übernommen`)
  return filled(chosen.text)
}

function isNativeRadio(el: Element): el is HTMLInputElement {
  return isTag(el, 'input') && el.type === 'radio'
}

function radioLabel(r: HTMLInputElement): string {
  const doc = r.ownerDocument
  if (r.id) {
    const forLabel = Array.from(doc.querySelectorAll('label')).find((l) => l.htmlFor === r.id)
    if (forLabel?.textContent?.trim()) return forLabel.textContent.trim()
  }
  const wrapping = r.closest('label')?.textContent?.trim()
  if (wrapping) return wrapping
  const aria = r.getAttribute('aria-label')?.trim()
  if (aria) return aria
  const ids = r.getAttribute('aria-labelledby')
  return ids ? ids.split(/\s+/).map((id) => doc.getElementById(id)?.textContent ?? '').join(' ').trim() : ''
}

function nativeGroup(first: HTMLInputElement): HTMLInputElement[] {
  if (!first.name) return [first]
  const scope: ParentNode = first.form ?? first.ownerDocument
  // Radio names are only unique per form, so radios of other forms must not join the group.
  return Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
    .filter((r) => r.name === first.name && r.form === first.form)
}

async function fillRadio(el: FormControl, choice: Choice, rand: Rand): Promise<FillOutcome> {
  const natives = isNativeRadio(el) ? nativeGroup(el) : Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
  if (natives.length > 0) {
    const options = natives.filter((r) => !r.disabled).map((r) => ({ el: r, text: radioLabel(r), value: r.value }))
    const chosen = choose(options, choice, rand)
    if (typeof chosen === 'string') return failed(chosen)
    // click() instead of `checked = true`: only a click fires the change event v-model listens to.
    if (!chosen.el.checked) chosen.el.click()
    if (!chosen.el.checked) return failed(`Option „${chosen.text}“ ließ sich nicht auswählen`)
    return filled(chosen.text)
  }

  const options = Array.from(el.querySelectorAll<HTMLElement>('[role="radio"]'))
    .filter((r) => r.getAttribute('aria-disabled') !== 'true')
    .map((r) => {
      const text = (r.getAttribute('aria-label') ?? r.textContent ?? '').trim()
      return { el: r, text, value: r.getAttribute('data-value') ?? text }
    })
  const chosen = choose(options, choice, rand)
  if (typeof chosen === 'string') return failed(chosen)
  if (chosen.el.getAttribute('aria-checked') !== 'true') {
    pointerPress(chosen.el)
    await nextFrame()
  }
  if (chosen.el.getAttribute('aria-checked') !== 'true') return failed(`Option „${chosen.text}“ ließ sich nicht auswählen`)
  return filled(chosen.text)
}

function wantedCheckState(v: Exclude<FieldValue, { kind: 'skip' }>, rand: Rand): boolean | string {
  if (v.kind === 'checkbox') return v.checked
  if (v.kind === 'date') return 'Datumswert passt nicht zu einer Checkbox'
  if (v.kind === 'choice' && v.mode === 'random') return rand() < 0.5
  const word = v.kind === 'text' ? v.value : (v.mode === 'fixed' ? v.values[0] : pick(v.values, rand))
  if (word === undefined) return 'Kein Wert für die Checkbox angegeben'
  if (TRUE_WORDS.has(norm(word))) return true
  if (FALSE_WORDS.has(norm(word))) return false
  return `Wert „${word}“ passt nicht zu einer Checkbox (erwartet ja/nein)`
}

function fillCheckbox(el: FormControl, v: Exclude<FieldValue, { kind: 'skip' }>, rand: Rand): FillOutcome {
  if (!isTag(el, 'input') || el.type !== 'checkbox') return failed('Feld ist keine Checkbox')
  if (el.disabled) return failed('Feld ist deaktiviert')
  const wanted = wantedCheckState(v, rand)
  if (typeof wanted === 'string') return failed(wanted)
  // click() instead of `checked =`: frameworks only see the change event a click produces.
  if (el.checked !== wanted) el.click()
  if (el.checked !== wanted) return failed('Checkbox ließ sich nicht umschalten')
  return filled(wanted ? 'Ja' : 'Nein')
}

/** ARIA 1.1 puts aria-controls on an inner textbox instead of the combobox wrapper. */
function comboboxInput(el: HTMLElement): HTMLElement {
  if (el.hasAttribute('aria-controls') || el.hasAttribute('aria-owns')) return el
  return el.querySelector<HTMLElement>('[aria-controls], [aria-owns]') ?? el
}

function openListbox(el: HTMLElement): HTMLElement | null {
  const host = comboboxInput(el)
  const ids = `${host.getAttribute('aria-controls') ?? ''} ${host.getAttribute('aria-owns') ?? ''}`.split(/\s+/).filter(Boolean)
  for (const id of ids) {
    const target = el.ownerDocument.getElementById(id)
    const listbox = target?.getAttribute('role') === 'listbox' ? target : target?.querySelector<HTMLElement>('[role="listbox"]')
    if (listbox && isVisible(listbox) && listbox.querySelector('[role="option"]')) return listbox
  }
  return null
}

async function waitForListbox(el: HTMLElement): Promise<HTMLElement | null> {
  const already = openListbox(el)
  if (already) return already
  const host = comboboxInput(el)
  focusQuietly(host)
  pointerPress(host)
  const start = performance.now()
  let arrowSent = false
  for (;;) {
    await nextFrame()
    const listbox = openListbox(el)
    if (listbox) return listbox
    if (performance.now() - start >= LISTBOX_TIMEOUT_MS) return null
    if (!arrowSent) {
      arrowSent = true
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true }))
    }
  }
}

/** What the combobox displays, without the text of a listbox nested inside it. */
function displayedText(el: HTMLElement): string {
  const host = comboboxInput(el)
  if (isTag(host, 'input')) return host.value
  if (isTag(el, 'input')) return el.value
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[role="listbox"]').forEach((n) => n.remove())
  return clone.textContent ?? ''
}

async function fillCombobox(el: FormControl, choice: Choice, rand: Rand): Promise<FillOutcome> {
  const listbox = await waitForListbox(el)
  if (!listbox) return failed('Auswahlliste nicht geöffnet')
  const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'))
    .filter((o) => o.getAttribute('aria-disabled') !== 'true')
    .map((o) => {
      const text = (o.textContent ?? '').trim()
      return { el: o, text, value: o.getAttribute('data-value') ?? text }
    })
  const chosen = choose(options, choice, rand)
  if (typeof chosen === 'string') return failed(chosen)
  pointerPress(chosen.el)
  await nextFrame()
  // Strict equality: a substring check would accept "Bitte wählen" for "IT" or a stale "Baustoffe" for "Bau".
  const shown = norm(displayedText(el))
  const ok = shown !== ''
    ? shown === norm(chosen.text)
    : chosen.el.isConnected && chosen.el.getAttribute('aria-selected') === 'true'
  if (!ok) return failed(`Option „${chosen.text}“ wurde nicht übernommen`)
  return filled(chosen.text)
}

/**
 * Writes `v` into `el` the way a user would, so framework bindings (Vue v-model) register it.
 * `skip` must be handled by the caller; passing it is a programming error and throws.
 */
export async function fillElement(el: FormControl, v: FieldValue, kind: ControlKind, rand: Rand = Math.random): Promise<FillOutcome> {
  if (v.kind === 'skip') throw new Error('fillElement must not be called with a skip value')
  if (kind === 'checkbox') return fillCheckbox(el, v, rand)
  if (v.kind === 'checkbox') return failed('Checkbox-Wert passt nicht zu diesem Feldtyp')
  switch (kind) {
    case 'text':
    case 'textarea':
    case 'date':
      return fillText(el, v, rand)
    case 'select': return fillSelect(el, asChoice(v), rand)
    case 'radiogroup': return fillRadio(el, asChoice(v), rand)
    case 'combobox': return fillCombobox(el, asChoice(v), rand)
  }
}
