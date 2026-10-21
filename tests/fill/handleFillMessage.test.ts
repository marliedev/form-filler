import { fakerDE } from '@faker-js/faker'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDataset } from '../../src/generators/dataset'
import { handleFillMessage } from '../../src/fill/handleFillMessage'
import type { Template } from '../../src/model/types'

const template: Template = {
  id: 't1', appId: 'app', name: 'Vorlage', process: null, lastMissing: [],
  fields: [{ id: 'f', label: 'F', locator: { kind: 'text', name: 'f' }, config: { type: 'fixed', value: 'x' }, slot: null, required: true, appendRunId: false }],
}

beforeEach(() => {
  document.body.innerHTML = '<input name="f">'
})

describe('handleFillMessage', () => {
  it('runs the fill for a valid message', async () => {
    const report = await handleFillMessage({ type: 'fill', template, dataset: createDataset(fakerDE), mode: 'all' }, document, fakerDE)
    expect(report.error).toBeUndefined()
    expect(report.filled).toBe(1)
  })

  it('returns an error report instead of throwing for an invalid template', async () => {
    const broken = { ...template, fields: [{ id: 'f' }] }
    const report = await handleFillMessage({ type: 'fill', template: broken, dataset: createDataset(fakerDE), mode: 'all' }, document, fakerDE)
    expect(report).toEqual({ templateId: 't1', filled: 0, total: 0, fields: [], error: 'Ungültige Vorlage – Befüllen nicht möglich' })
    expect(document.querySelector<HTMLInputElement>('[name="f"]')?.value).toBe('')
  })

  it('returns an error report for a missing dataset', async () => {
    const report = await handleFillMessage({ type: 'fill', template, mode: 'all' }, document, fakerDE)
    expect(report.error).toBeTruthy()
  })
})
