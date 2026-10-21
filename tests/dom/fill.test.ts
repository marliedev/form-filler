import { beforeEach, describe, expect, it } from 'vitest'
import { fillElement, nextFrame } from '../../src/dom/fill'
import type { FormControl } from '../../src/dom/locator'

function setup(html: string): void {
  document.body.innerHTML = html
}

function q<T extends FormControl>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`missing ${selector}`)
  return el
}

function countEvents(el: Element, ...types: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const t of types) {
    counts[t] = 0
    el.addEventListener(t, () => { counts[t] = (counts[t] ?? 0) + 1 })
  }
  return counts
}

/** Deterministic sequence of "random" numbers for injected randomness. */
function seq(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length] ?? 0
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('fillElement – text', () => {
  it('sets the value and fires input and change exactly once each', async () => {
    setup('<input id="t" name="company">')
    const el = q<HTMLInputElement>('#t')
    const counts = countEvents(el, 'input', 'change')
    const out = await fillElement(el, { kind: 'text', value: 'Muster GmbH' }, 'text')
    expect(out).toEqual({ status: 'filled', shown: 'Muster GmbH' })
    expect(el.value).toBe('Muster GmbH')
    expect(counts).toEqual({ input: 1, change: 1 })
  })

  it('events bubble so delegated listeners see them', async () => {
    setup('<form><textarea id="t"></textarea></form>')
    const seen: string[] = []
    q('form').addEventListener('input', () => seen.push('input'))
    q('form').addEventListener('change', () => seen.push('change'))
    await fillElement(q('#t'), { kind: 'text', value: 'Hallo' }, 'textarea')
    expect(seen).toEqual(['input', 'change'])
    expect(q<HTMLTextAreaElement>('#t').value).toBe('Hallo')
  })

  it('uses the prototype setter even if the instance value property is overridden', async () => {
    setup('<input id="t">')
    const el = q<HTMLInputElement>('#t')
    // Frameworks like React shadow the instance property; a plain assignment would bypass their tracking.
    let shadowWrites = 0
    Object.defineProperty(el, 'value', {
      configurable: true,
      get() { return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.get?.call(el) as string },
      set() { shadowWrites++ },
    })
    await fillElement(el, { kind: 'text', value: 'abc' }, 'text')
    expect(shadowWrites).toBe(0)
    expect(el.value).toBe('abc')
  })

  it('cuts values to maxLength so the read-back matches', async () => {
    setup('<input id="t" maxlength="5">')
    const out = await fillElement(q('#t'), { kind: 'text', value: 'ABCDEFGH' }, 'text')
    expect(out).toEqual({ status: 'filled', shown: 'ABCDE' })
    expect(q<HTMLInputElement>('#t').value).toBe('ABCDE')
  })

  it('writes a fixed choice as values[0] and a random choice as one of the values', async () => {
    setup('<input id="a"><input id="b">')
    await fillElement(q('#a'), { kind: 'choice', mode: 'fixed', values: ['eins', 'zwei'] }, 'text')
    expect(q<HTMLInputElement>('#a').value).toBe('eins')
    await fillElement(q('#b'), { kind: 'choice', mode: 'random', values: ['eins', 'zwei'] }, 'text', seq(0.9))
    expect(q<HTMLInputElement>('#b').value).toBe('zwei')
  })

  it('fails for disabled and readonly fields', async () => {
    setup('<input id="d" disabled><input id="r" readonly>')
    expect((await fillElement(q('#d'), { kind: 'text', value: 'x' }, 'text')).status).toBe('failed')
    expect((await fillElement(q('#r'), { kind: 'text', value: 'x' }, 'text')).status).toBe('failed')
  })

  it('fails with a reason for a checkbox value on a text field', async () => {
    setup('<input id="t">')
    const out = await fillElement(q('#t'), { kind: 'checkbox', checked: true }, 'text')
    expect(out.status).toBe('failed')
  })

  it('throws for skip because callers must handle it', async () => {
    setup('<input id="t">')
    await expect(fillElement(q('#t'), { kind: 'skip' }, 'text')).rejects.toThrow()
  })
})

describe('fillElement – date', () => {
  it('writes YYYY-MM-DD into type=date', async () => {
    setup('<input id="d" type="date">')
    const out = await fillElement(q('#d'), { kind: 'date', iso: '2024-03-15' }, 'date')
    expect(out).toEqual({ status: 'filled', shown: '2024-03-15' })
    expect(q<HTMLInputElement>('#d').value).toBe('2024-03-15')
  })

  it('writes DD.MM.YYYY into a text field', async () => {
    setup('<input id="d" type="text">')
    const out = await fillElement(q('#d'), { kind: 'date', iso: '2024-03-15' }, 'text')
    expect(out).toEqual({ status: 'filled', shown: '15.03.2024' })
  })

  it('writes a text value on kind date as-is', async () => {
    setup('<input id="d" type="date">')
    await fillElement(q('#d'), { kind: 'text', value: '2023-01-02' }, 'date')
    expect(q<HTMLInputElement>('#d').value).toBe('2023-01-02')
  })
})

const SELECT = `
  <select id="s">
    <option value="">Bitte wählen</option>
    <option value="it">IT</option>
    <option value="handel">Handel</option>
    <option value="bau">Bau</option>
    <option value="x" disabled>Gesperrt</option>
  </select>`

describe('fillElement – select', () => {
  it('random never picks the placeholder (50 runs)', async () => {
    setup(SELECT)
    const el = q<HTMLSelectElement>('#s')
    for (let i = 0; i < 50; i++) {
      el.selectedIndex = 0
      const out = await fillElement(el, { kind: 'choice', mode: 'random', values: [] }, 'select')
      expect(out.status).toBe('filled')
      expect(['it', 'handel', 'bau']).toContain(el.value)
    }
  })

  it('random covers the edges of the random range without hitting placeholder or disabled options', async () => {
    setup(SELECT)
    const el = q<HTMLSelectElement>('#s')
    await fillElement(el, { kind: 'choice', mode: 'random', values: [] }, 'select', () => 0)
    expect(el.value).toBe('it')
    await fillElement(el, { kind: 'choice', mode: 'random', values: [] }, 'select', () => 0.999999)
    expect(el.value).toBe('bau')
  })

  it('subset picks only from values, matched by text or value ignoring case', async () => {
    setup(SELECT)
    const el = q<HTMLSelectElement>('#s')
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const out = await fillElement(el, { kind: 'choice', mode: 'subset', values: [' handel ', 'BAU'] }, 'select')
      expect(out.status).toBe('filled')
      seen.add(el.value)
    }
    expect([...seen].sort()).toEqual(['bau', 'handel'])
  })

  it('fixed selects the matching option, fires change and reports the option text', async () => {
    setup(SELECT)
    const el = q<HTMLSelectElement>('#s')
    const counts = countEvents(el, 'input', 'change')
    const out = await fillElement(el, { kind: 'choice', mode: 'fixed', values: ['handel'] }, 'select')
    expect(out).toEqual({ status: 'filled', shown: 'Handel' })
    expect(el.value).toBe('handel')
    expect(counts).toEqual({ input: 1, change: 1 })
  })

  it('fixed with an unknown value fails and names the value', async () => {
    setup(SELECT)
    const out = await fillElement(q('#s'), { kind: 'choice', mode: 'fixed', values: ['Landwirtschaft'] }, 'select')
    expect(out.status).toBe('failed')
    if (out.status === 'failed') expect(out.reason).toContain('Landwirtschaft')
  })

  it('treats a text value as fixed choice', async () => {
    setup(SELECT)
    await fillElement(q('#s'), { kind: 'text', value: 'IT' }, 'select')
    expect(q<HTMLSelectElement>('#s').value).toBe('it')
  })
})

const RADIOS = `
  <form>
    <fieldset><legend>Rolle</legend>
      <label><input type="radio" name="role" value="participant"> Teilnehmer</label>
      <label><input type="radio" name="role" value="manager"> Lernmanager</label>
      <input type="radio" name="role" value="admin" id="r-admin"><label for="r-admin">Admin</label>
    </fieldset>
  </form>
  <form><input type="radio" name="role" value="other" id="foreign"><label for="foreign">Lernmanager</label></form>`

describe('fillElement – radiogroup', () => {
  it('fixed "Lernmanager" checks exactly that radio within the same form', async () => {
    setup(RADIOS)
    const first = q<HTMLInputElement>('input[value=participant]')
    const out = await fillElement(first, { kind: 'choice', mode: 'fixed', values: ['Lernmanager'] }, 'radiogroup')
    expect(out).toEqual({ status: 'filled', shown: 'Lernmanager' })
    const checked = Array.from(document.querySelectorAll<HTMLInputElement>('input[type=radio]')).filter((r) => r.checked)
    expect(checked.map((r) => r.value)).toEqual(['manager'])
  })

  it('matches a radio by value and via label[for]', async () => {
    setup(RADIOS)
    const first = q<HTMLInputElement>('input[value=participant]')
    await fillElement(first, { kind: 'text', value: 'ADMIN' }, 'radiogroup')
    expect(q<HTMLInputElement>('#r-admin').checked).toBe(true)
  })

  it('fires a change event on the selected radio (click, not checked=)', async () => {
    setup(RADIOS)
    const manager = q<HTMLInputElement>('input[value=manager]')
    const counts = countEvents(manager, 'click', 'change')
    await fillElement(q('input[value=participant]'), { kind: 'choice', mode: 'fixed', values: ['manager'] }, 'radiogroup')
    expect(counts).toEqual({ click: 1, change: 1 })
  })

  it('works on an ARIA radiogroup wrapping native radios and on role=radio items', async () => {
    setup(`
      <div role="radiogroup" id="g1">
        <label><input type="radio" name="size" value="s"> Klein</label>
        <label><input type="radio" name="size" value="l"> Groß</label>
      </div>
      <div role="radiogroup" id="g2">
        <div role="radio" aria-checked="false" id="ja">Ja</div>
        <div role="radio" aria-checked="false" id="nein">Nein</div>
      </div>`)
    await fillElement(q('#g1'), { kind: 'choice', mode: 'fixed', values: ['groß'] }, 'radiogroup')
    expect(q<HTMLInputElement>('input[value=l]').checked).toBe(true)
    // A custom role=radio flips aria-checked in its own click handler.
    for (const r of Array.from(document.querySelectorAll('[role=radio]'))) {
      r.addEventListener('click', () => {
        document.querySelectorAll('[role=radio]').forEach((o) => o.setAttribute('aria-checked', String(o === r)))
      })
    }
    const out = await fillElement(q('#g2'), { kind: 'choice', mode: 'fixed', values: ['Nein'] }, 'radiogroup')
    expect(out).toEqual({ status: 'filled', shown: 'Nein' })
    expect(q('#nein').getAttribute('aria-checked')).toBe('true')
  })

  it('fails when the role=radio does not react', async () => {
    setup('<div role="radiogroup" id="g"><div role="radio" aria-checked="false">Ja</div></div>')
    const out = await fillElement(q('#g'), { kind: 'choice', mode: 'fixed', values: ['Ja'] }, 'radiogroup')
    expect(out.status).toBe('failed')
  })
})

describe('fillElement – checkbox', () => {
  it('checked:true on an already checked box keeps it checked (no toggle)', async () => {
    setup('<input type="checkbox" id="c" checked>')
    const el = q<HTMLInputElement>('#c')
    const counts = countEvents(el, 'click')
    const out = await fillElement(el, { kind: 'checkbox', checked: true }, 'checkbox')
    expect(out.status).toBe('filled')
    expect(el.checked).toBe(true)
    expect(counts.click).toBe(0)
  })

  it('toggles via click when the state differs', async () => {
    setup('<input type="checkbox" id="c">')
    const el = q<HTMLInputElement>('#c')
    const counts = countEvents(el, 'click', 'change')
    await fillElement(el, { kind: 'checkbox', checked: true }, 'checkbox')
    expect(el.checked).toBe(true)
    expect(counts).toEqual({ click: 1, change: 1 })
    await fillElement(el, { kind: 'checkbox', checked: false }, 'checkbox')
    expect(el.checked).toBe(false)
  })

  it('interprets a text value like "ja"/"nein" and fails for unknown words', async () => {
    setup('<input type="checkbox" id="c">')
    const el = q<HTMLInputElement>('#c')
    await fillElement(el, { kind: 'text', value: 'Ja' }, 'checkbox')
    expect(el.checked).toBe(true)
    const out = await fillElement(el, { kind: 'text', value: 'vielleicht' }, 'checkbox')
    expect(out.status).toBe('failed')
  })
})

describe('fillElement – combobox', () => {
  function combobox(): void {
    setup(`
      <div role="combobox" id="cb" tabindex="0" aria-controls="lb" aria-expanded="false"><span id="shown"></span></div>
      <ul role="listbox" id="lb" hidden>
        <li role="option" data-value="de">Deutschland</li>
        <li role="option" aria-disabled="true">Gesperrt</li>
        <li role="option" data-value="at">Österreich</li>
      </ul>`)
    const cb = q('#cb')
    const lb = q('#lb')
    cb.addEventListener('click', () => { lb.hidden = false })
    for (const opt of Array.from(lb.querySelectorAll('[role=option]'))) {
      opt.addEventListener('mousedown', () => {
        q('#shown').textContent = opt.textContent
        lb.hidden = true
      })
    }
  }

  it('opens the listbox by click and selects the option via mousedown', async () => {
    combobox()
    const out = await fillElement(q('#cb'), { kind: 'choice', mode: 'fixed', values: ['österreich'] }, 'combobox')
    expect(out).toEqual({ status: 'filled', shown: 'Österreich' })
    expect(q('#shown').textContent).toBe('Österreich')
  })

  it('falls back to ArrowDown when click does not open the listbox', async () => {
    combobox()
    const cb = q('#cb')
    const lb = q('#lb')
    cb.replaceWith(cb.cloneNode(true))
    q('#cb').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'ArrowDown') lb.hidden = false })
    const out = await fillElement(q('#cb'), { kind: 'text', value: 'Deutschland' }, 'combobox')
    expect(out).toEqual({ status: 'filled', shown: 'Deutschland' })
  })

  it('never picks an aria-disabled option', async () => {
    combobox()
    const out = await fillElement(q('#cb'), { kind: 'choice', mode: 'fixed', values: ['Gesperrt'] }, 'combobox')
    expect(out.status).toBe('failed')
  })

  it('fails with "Auswahlliste nicht geöffnet" when no listbox appears within 500 ms', async () => {
    setup('<div role="combobox" id="cb" tabindex="0" aria-controls="lb"></div><ul role="listbox" id="lb" hidden><li role="option">A</li></ul>')
    const start = performance.now()
    const out = await fillElement(q('#cb'), { kind: 'choice', mode: 'random', values: [] }, 'combobox')
    expect(out).toEqual({ status: 'failed', reason: 'Auswahlliste nicht geöffnet' })
    expect(performance.now() - start).toBeGreaterThanOrEqual(450)
  })
})

describe('nextFrame', () => {
  it('resolves', async () => {
    await expect(nextFrame()).resolves.toBeUndefined()
  })
})
