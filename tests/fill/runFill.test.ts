import { fakerDE } from '@faker-js/faker'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDataset, ensureSlots, type Dataset } from '../../src/generators/dataset'
import { runFill } from '../../src/fill/runFill'
import type { DataTypeConfig, FieldRule, Template } from '../../src/model/types'

function rule(id: string, config: DataTypeConfig, extra: Partial<FieldRule> = {}): FieldRule {
  return { id, label: `Feld ${id}`, locator: { kind: 'text', name: id }, config, slot: null, required: true, appendRunId: false, ...extra }
}

function template(fields: FieldRule[]): Template {
  return { id: 't1', appId: 'app', name: 'Vorlage', process: null, fields, lastMissing: [] }
}

function input(name: string): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>(`[name="${name}"]`)
  if (!el) throw new Error(`missing ${name}`)
  return el
}

let ds: Dataset

beforeEach(() => {
  fakerDE.seed(42)
  document.body.innerHTML = ''
  ds = createDataset(fakerDE)
})

describe('runFill', () => {
  it('fills fields in template order and reports missing ones without stopping', async () => {
    document.body.innerHTML = '<input name="company"><input name="first">'
    const t = template([
      rule('company', { type: 'companyName' }),
      rule('gone', { type: 'fixed', value: 'x' }),
      rule('first', { type: 'firstName' }),
    ])
    const report = await runFill(document.body, t, ensureSlots(ds, t, fakerDE), 'all', fakerDE)

    expect(input('company').value).toBe(ds.company.name)
    expect(input('first').value).toBe(ds.persons['1']?.firstName)
    expect(report.templateId).toBe('t1')
    expect(report.fields.map((f) => [f.fieldId, f.status])).toEqual([
      ['company', 'filled'],
      ['gone', 'missing'],
      ['first', 'filled'],
    ])
    expect(report.fields[1]?.label).toBe('Feld gone')
    expect(report.filled).toBe(2)
    expect(report.total).toBe(3)
  })

  it('waits a frame between fields so conditionally rendered fields appear', async () => {
    document.body.innerHTML = '<input name="trigger">'
    input('trigger').addEventListener('input', () => {
      requestAnimationFrame(() => {
        if (document.querySelector('[name="late"]')) return
        const late = document.createElement('input')
        late.name = 'late'
        document.body.append(late)
      })
    })
    const t = template([rule('trigger', { type: 'fixed', value: 'ja' }), rule('late', { type: 'fixed', value: 'da' })])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.fields.map((f) => f.status)).toEqual(['filled', 'filled'])
    expect(input('late').value).toBe('da')
  })

  it('mode required fills only required fields and skips the rest', async () => {
    document.body.innerHTML = '<input name="a"><input name="b" value="unverändert"><input name="c">'
    const t = template([
      rule('a', { type: 'fixed', value: 'A' }),
      rule('b', { type: 'fixed', value: 'B' }, { required: false }),
      rule('c', { type: 'fixed', value: 'C' }),
    ])
    const report = await runFill(document.body, t, ds, 'required', fakerDE)
    expect(input('a').value).toBe('A')
    expect(input('b').value).toBe('unverändert')
    expect(input('c').value).toBe('C')
    expect(report.fields[1]).toEqual({ fieldId: 'b', label: 'Feld b', status: 'skipped', detail: 'Optional' })
    expect(report.filled).toBe(2)
    expect(report.total).toBe(2)
  })

  it('reports empty rules as skipped with a reason', async () => {
    document.body.innerHTML = '<input name="e" value="x">'
    const report = await runFill(document.body, template([rule('e', { type: 'empty' })]), ds, 'all', fakerDE)
    expect(report.fields).toEqual([{ fieldId: 'e', label: 'Feld e', status: 'skipped', detail: 'Leer lassen' }])
    expect(input('e').value).toBe('x')
    expect(report.total).toBe(0)
  })

  it('reports rules with incomplete options as failed without touching the field', async () => {
    document.body.innerHTML = '<input name="l" value="y"><input name="p" value="y"><input name="f" value="y">'
    const t = template([
      rule('l', { type: 'list', values: [] }),
      rule('p', { type: 'pattern', pattern: '' }),
      rule('f', { type: 'fixed', value: '' }),
    ])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.fields.map((f) => f.status)).toEqual(['failed', 'failed', 'failed'])
    expect(report.fields[0]?.detail).toMatch(/^Optionen unvollständig: /)
    expect(['l', 'p', 'f'].map((n) => input(n).value)).toEqual(['y', 'y', 'y'])
    expect(report.filled).toBe(0)
    expect(report.total).toBe(3)
  })

  it('reports ambiguous fields', async () => {
    document.body.innerHTML = '<input name="dup"><input name="dup">'
    const report = await runFill(document.body, template([rule('dup', { type: 'fixed', value: 'x' })]), ds, 'all', fakerDE)
    expect(report.fields[0]?.status).toBe('ambiguous')
    expect(report.fields[0]?.detail).toContain('2')
  })

  it('reports a field as failed when resolving throws and continues', async () => {
    document.body.innerHTML = '<input name="p"><input name="ok">'
    const t = template([
      rule('p', { type: 'firstName' }, { slot: '9' }),
      rule('ok', { type: 'fixed', value: 'ok' }),
    ])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.fields[0]?.status).toBe('failed')
    expect(report.fields[0]?.detail).toBeTruthy()
    expect(input('ok').value).toBe('ok')
    expect(report.filled).toBe(1)
  })

  it('reports fill failures with the reason from the filler', async () => {
    document.body.innerHTML = '<select name="s"><option>Eins</option></select>'
    const t = template([rule('s', { type: 'choice', mode: 'fixed', values: ['Zwei'] }, { locator: { kind: 'select', name: 's' } })])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.fields[0]?.status).toBe('failed')
    expect(report.fields[0]?.detail).toBeTruthy()
  })

  it('appends the run id within the maxlength of the element', async () => {
    document.body.innerHTML = '<input name="n" maxlength="12"><input name="free">'
    const t = template([
      rule('n', { type: 'fixed', value: 'Mustermann GmbH' }, { appendRunId: true }),
      rule('free', { type: 'fixed', value: 'Mustermann GmbH' }, { appendRunId: true }),
    ])
    const report = await runFill(document.body, t, ds, 'all', fakerDE)
    expect(report.filled).toBe(2)
    expect(input('n').value).toBe(`Must · ${ds.runId}`)
    expect(input('free').value).toBe(`Mustermann GmbH · ${ds.runId}`)
  })
})
