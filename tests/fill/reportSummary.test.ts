import { describe, expect, it } from 'vitest'
import type { FillReport } from '../../src/fill/runFill'
import { problemCount, summarizeReport } from '../../src/fill/reportSummary'

const base: FillReport = { templateId: 't', filled: 0, total: 0, fields: [] }

describe('summarizeReport', () => {
  it('names filled and missing fields', () => {
    const r: FillReport = {
      ...base,
      filled: 11,
      total: 12,
      fields: [
        ...Array.from({ length: 11 }, (_, i) => ({ fieldId: `f${i}`, label: `F${i}`, status: 'filled' as const })),
        { fieldId: 'x', label: 'X', status: 'missing' },
      ],
    }
    expect(summarizeReport(r)).toBe('11 von 12 befüllt · 1 nicht gefunden')
    expect(problemCount(r)).toBe(1)
  })

  it('lists every problem kind', () => {
    const r: FillReport = {
      ...base,
      filled: 0,
      total: 4,
      fields: [
        { fieldId: 'a', label: 'A', status: 'missing' },
        { fieldId: 'b', label: 'B', status: 'missing' },
        { fieldId: 'c', label: 'C', status: 'ambiguous' },
        { fieldId: 'd', label: 'D', status: 'failed' },
        { fieldId: 'e', label: 'E', status: 'skipped' },
      ],
    }
    expect(summarizeReport(r)).toBe('0 von 4 befüllt · 2 nicht gefunden · 1 mehrdeutig · 1 nicht befüllbar')
    expect(problemCount(r)).toBe(4)
  })

  it('reports a complete run', () => {
    const r: FillReport = { ...base, filled: 1, total: 1, fields: [{ fieldId: 'a', label: 'A', status: 'filled' }] }
    expect(summarizeReport(r)).toBe('1 von 1 befüllt')
    expect(problemCount(r)).toBe(0)
  })

  it('counts a run error as one problem', () => {
    expect(problemCount({ ...base, error: 'kaputt' })).toBe(1)
  })
})
