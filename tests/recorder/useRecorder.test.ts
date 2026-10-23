import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { FieldRule, Template } from '../../src/model/types'
import {
  configFor,
  nextSlot,
  parseLines,
  resolveControl,
  slotChoices,
  typeGroups,
  useRecorder,
} from '../../src/recorder/useRecorder'
import { getTemplate, saveTemplate } from '../../src/storage/repository'
import { q as deepQ, shadow } from '../dom/deepHelpers'

const base: Template = { id: 't1', appId: 'app', name: 'Kunde', process: null, fields: [], lastMissing: [] }

function q<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`missing ${selector}`)
  return el
}

function field(partial: Partial<FieldRule> & Pick<FieldRule, 'id' | 'locator'>): FieldRule {
  return { label: partial.id, config: { type: 'text' }, slot: null, required: false, appendRunId: false, ...partial }
}

beforeEach(async () => {
  fakeBrowser.reset()
  document.body.innerHTML = `
    <form>
      <label for="company">Firmenname *</label><input id="company" name="company">
      <label for="first">Vorname</label><input id="first" name="first">
      <label for="zip">PLZ</label><input id="zip" name="zip" required>
      <input name="ref" placeholder="Referenz">
      <button type="submit">Senden</button>
      <fieldset><legend>Typ</legend>
        <input type="radio" name="kind" value="a"><input type="radio" name="kind" value="b">
      </fieldset>
      <div role="radiogroup" aria-label="Größe"><div role="radio" tabindex="0">S</div></div>
    </form>`
  await saveTemplate(base)
})

describe('capture', () => {
  it('captures on plain-http pages where crypto.randomUUID is unavailable', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    try {
      const r = useRecorder(base)
      expect(r.capture(q('#company'))).toBe(true)
      expect(r.pending.value?.rule.id).toMatch(/^[0-9a-f-]{36}$/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('fills pending.rule with the suggestion, the required flag and a default label', () => {
    const r = useRecorder(base)
    expect(r.capture(q('#company'))).toBe(true)
    const pending = r.pending.value
    expect(pending?.el).toBe(q('#company'))
    expect(pending?.isNew).toBe(true)
    expect(pending?.rule).toMatchObject({
      label: 'Firmenname',
      locator: { kind: 'text', id: 'company', name: 'company', label: 'firmenname' },
      config: { type: 'companyName' },
      slot: null,
      required: true,
      appendRunId: false,
    })
    r.capture(q('#zip'))
    expect(r.pending.value?.rule).toMatchObject({ config: { type: 'zip' }, slot: 'A', required: true })
  })

  it('flags fields the fill could not find again by their locator', () => {
    document.body.insertAdjacentHTML('beforeend', '<input aria-label="Notiz"><input placeholder="Suche">')
    const r = useRecorder(base)
    r.capture(q('#company'))
    expect(r.pending.value?.unlocatable).toBe(false)
    r.capture(q('input[aria-label="Notiz"]'))
    expect(r.pending.value?.unlocatable).toBe(true)
    r.capture(q('input[placeholder="Suche"]'))
    expect(r.pending.value?.unlocatable).toBe(true)
    // An ARIA group's aria-label is its group label, so it is found again.
    r.capture(q('[role="radiogroup"]'))
    expect(r.pending.value?.unlocatable).toBe(false)
  })

  it('does not flag a native radio group captured via a later radio', () => {
    const r = useRecorder(base)
    r.capture(q('input[value="b"]'))
    expect(r.pending.value?.unlocatable).toBe(false)
  })

  it('ignores unsupported elements', () => {
    const r = useRecorder(base)
    expect(r.capture(q('button'))).toBe(false)
    expect(r.pending.value).toBeNull()
  })

  it('opens an already captured element for editing instead of a new rule', () => {
    const existing = field({ id: 'f1', label: 'Firma', locator: { kind: 'text', name: 'company' }, config: { type: 'fixed', value: 'ACME' } })
    const r = useRecorder({ ...base, fields: [existing] })
    r.capture(q('#company'))
    expect(r.pending.value?.isNew).toBe(false)
    expect(r.pending.value?.rule).toEqual(existing)
  })

  it('treats another radio of the same group as the captured group', () => {
    const r = useRecorder(base)
    r.capture(q('input[value="a"]'))
    const rule = r.pending.value?.rule
    if (!rule) throw new Error('no pending rule')
    r.accept(rule)
    r.capture(q('input[value="b"]'))
    expect(r.pending.value?.isNew).toBe(false)
    expect(r.pending.value?.rule.id).toBe(rule.id)
  })
})

describe('accept / remove', () => {
  it('appends new fields at the end and replaces re-captured ones in place', () => {
    const r = useRecorder(base)
    r.capture(q('#company'))
    const company = r.pending.value?.rule
    if (!company) throw new Error('no pending rule')
    r.accept(company)
    r.capture(q('#first'))
    const first = r.pending.value?.rule
    if (!first) throw new Error('no pending rule')
    r.accept(first)
    expect(r.fields.value.map((f) => f.id)).toEqual([company.id, first.id])
    expect(r.pending.value).toBeNull()

    r.capture(q('#company'))
    const edited = r.pending.value?.rule
    if (!edited) throw new Error('no pending rule')
    r.accept({ ...edited, required: false })
    expect(r.fields.value).toHaveLength(2)
    expect(r.fields.value[0]).toMatchObject({ id: company.id, required: false })
  })

  it('does not let the caller mutate stored fields through the pending rule', () => {
    const existing = field({ id: 'f1', locator: { kind: 'text', name: 'company' } })
    const r = useRecorder({ ...base, fields: [existing] })
    r.capture(q('#company'))
    const rule = r.pending.value?.rule
    if (!rule) throw new Error('no pending rule')
    rule.required = true
    expect(r.fields.value[0]?.required).toBe(false)
  })

  it('removes a field and tracks unsaved changes', () => {
    const existing = field({ id: 'f1', locator: { kind: 'text', name: 'company' } })
    const r = useRecorder({ ...base, fields: [existing] })
    expect(r.dirty.value).toBe(false)
    r.remove('f1')
    expect(r.fields.value).toEqual([])
    expect(r.dirty.value).toBe(true)
  })

  it('is only dirty while the field list differs from the saved state', async () => {
    const existing = field({ id: 'f1', locator: { kind: 'text', name: 'company' } })
    const r = useRecorder({ ...base, fields: [existing] })
    r.capture(q('#company'))
    const unchanged = r.pending.value?.rule
    if (!unchanged) throw new Error('no pending rule')
    r.accept(unchanged)
    expect(r.dirty.value).toBe(false)
    r.accept({ ...unchanged, required: true })
    expect(r.dirty.value).toBe(true)
    r.accept({ ...unchanged, required: false })
    expect(r.dirty.value).toBe(false)
    r.capture(q('#first'))
    const added = r.pending.value?.rule
    if (!added) throw new Error('no pending rule')
    r.accept(added)
    expect(r.dirty.value).toBe(true)
    await r.save()
    expect(r.dirty.value).toBe(false)
  })

  it('dismiss closes the popover without changing fields', () => {
    const r = useRecorder(base)
    r.capture(q('#company'))
    r.dismiss()
    expect(r.pending.value).toBeNull()
    expect(r.fields.value).toEqual([])
    expect(r.dirty.value).toBe(false)
  })
})

describe('save / cancel', () => {
  it('save writes the template with the field order preserved', async () => {
    const r = useRecorder(base)
    for (const sel of ['#zip', '#company', '#first']) {
      r.capture(q(sel))
      const rule = r.pending.value?.rule
      if (!rule) throw new Error('no pending rule')
      r.accept(rule)
    }
    await r.save()
    const stored = await getTemplate('t1')
    expect(stored?.fields.map((f) => f.locator.id)).toEqual(['zip', 'company', 'first'])
    expect(stored?.name).toBe('Kunde')
    expect(r.dirty.value).toBe(false)
  })

  it('save keeps changes made elsewhere and drops lastMissing ids of removed fields', async () => {
    const a = field({ id: 'a', locator: { kind: 'text', name: 'company' } })
    const b = field({ id: 'b', locator: { kind: 'text', name: 'first' } })
    const t: Template = { ...base, fields: [a, b] }
    await saveTemplate({ ...t, name: 'Umbenannt', lastMissing: ['a', 'b'] })
    const r = useRecorder(t)
    r.remove('a')
    await r.save()
    const stored = await getTemplate('t1')
    expect(stored?.name).toBe('Umbenannt')
    expect(stored?.lastMissing).toEqual(['b'])
    expect(stored?.fields.map((f) => f.id)).toEqual(['b'])
  })

  it('cancel writes nothing and restores the original fields', async () => {
    const r = useRecorder(base)
    r.capture(q('#company'))
    const rule = r.pending.value?.rule
    if (!rule) throw new Error('no pending rule')
    r.accept(rule)
    r.cancel()
    expect(r.fields.value).toEqual([])
    expect(r.pending.value).toBeNull()
    expect(r.dirty.value).toBe(false)
    expect((await getTemplate('t1'))?.fields).toEqual([])
  })
})

describe('helpers', () => {
  it('resolveControl maps inner radios to their ARIA group and rejects non-controls', () => {
    expect(resolveControl(q('[role="radio"]'))).toBe(q('[role="radiogroup"]'))
    expect(resolveControl(q('input[value="a"]'))).toBe(q('input[value="a"]'))
    expect(resolveControl(q('button'))).toBeNull()
    expect(resolveControl(q('legend'))).toBeNull()
  })

  it('nextSlot returns the first free person number or address letter', () => {
    expect(nextSlot('person', [])).toBe('1')
    expect(nextSlot('person', ['1', '2'])).toBe('3')
    expect(nextSlot('address', ['A'])).toBe('B')
  })

  it('slotChoices lists used slots of a kind plus the default and the next free one', () => {
    const fields = [
      field({ id: 'a', locator: { kind: 'text' }, config: { type: 'firstName' }, slot: '2' }),
      field({ id: 'b', locator: { kind: 'text' }, config: { type: 'zip' }, slot: 'A' }),
    ]
    expect(slotChoices(fields, 'person')).toEqual({ existing: ['1', '2'], next: '3' })
    expect(slotChoices(fields, 'address')).toEqual({ existing: ['A'], next: 'B' })
  })

  it('new rules default to the slot of the last captured field of the same kind', () => {
    const fields = [field({ id: 'a', locator: { kind: 'text', name: 'x' }, config: { type: 'lastName' }, slot: '2' })]
    const r = useRecorder({ ...base, fields })
    r.capture(q('#first'))
    expect(r.pending.value?.rule).toMatchObject({ config: { type: 'firstName' }, slot: '2' })
  })

  it('configFor reuses a candidate of the same type, else returns defaults', () => {
    expect(configFor('pattern', [{ type: 'pattern', pattern: 'X-{zahl:3}' }])).toEqual({ type: 'pattern', pattern: 'X-{zahl:3}' })
    expect(configFor('number', [{ type: 'text' }])).toEqual({ type: 'number', min: 1, max: 100 })
    expect(configFor('birthDate', [])).toEqual({ type: 'birthDate', minAge: 18 })
    expect(configFor('choice', [])).toEqual({ type: 'choice', mode: 'random', values: [] })
    expect(configFor('email', [])).toEqual({ type: 'email' })
  })

  it('typeGroups filters by control kind but always offers the Steuerung group and the current type', () => {
    const checkbox = typeGroups('checkbox')
    expect(checkbox.map((g) => g.group)).toEqual(['Steuerung'])
    const date = typeGroups('date', 'iban')
    expect(date.flatMap((g) => g.types.map((t) => t.type))).toEqual(
      expect.arrayContaining(['birthDate', 'date', 'fixed', 'pattern', 'empty', 'iban']),
    )
    expect(date.flatMap((g) => g.types.map((t) => t.type))).not.toContain('firstName')
  })
})

describe('parseLines', () => {
  it('keeps one trimmed value per non-empty line', () => {
    expect(parseLines(' A \n\nB\n  ')).toEqual(['A', 'B'])
  })
})

describe('useRecorder – shadow DOM', () => {
  it('treats equally labelled fields in different hosts as different fields', () => {
    document.body.innerHTML = '<wc-x id="a"></wc-x><wc-x id="b"></wc-x>'
    const inA = deepQ<HTMLInputElement>('input', shadow(deepQ('#a'), '<label for="z">PLZ</label><input id="z" name="zip">'))
    const inB = deepQ<HTMLInputElement>('input', shadow(deepQ('#b'), '<label for="z">PLZ</label><input id="z" name="zip">'))
    const r = useRecorder(base)
    expect(r.capture(inA)).toBe(true)
    expect(r.pending.value?.rule.locator.scope).toEqual(['wc-x#a'])
    expect(r.pending.value?.unlocatable).toBe(false)
    const first = r.pending.value?.rule
    if (!first) throw new Error('no pending rule')
    r.accept(first)
    expect(r.capture(inB)).toBe(true)
    expect(r.pending.value?.isNew).toBe(true)
    expect(r.pending.value?.rule.locator.scope).toEqual(['wc-x#b'])
    const second = r.pending.value?.rule
    if (!second) throw new Error('no pending rule')
    r.accept(second)
    expect(r.fields.value).toHaveLength(2)
  })
})
