import { describe, expect, it } from 'vitest'
import { APP, CAPTIONS, DATASETS, FIELDS, RUN_IDS } from '../../promo/video/data'

describe('promo data', () => {
  it('has the 12 fields of the spec in order, with the required markers', () => {
    expect(FIELDS.map((f) => f.label)).toEqual([
      'Firma', 'Anrede', 'Vorname', 'Nachname', 'E-Mail', 'Telefon',
      'Straße', 'PLZ', 'Ort', 'Kundennummer', 'Rechnungs-E-Mail', 'IBAN',
    ])
    expect(FIELDS.filter((f) => !f.required).map((f) => f.key)).toEqual(['phone', 'billingEmail', 'iban'])
  })

  it('second dataset differs from the first in every field', () => {
    for (const f of FIELDS) expect(DATASETS[1][f.key]).not.toBe(DATASETS[0][f.key])
  })

  it('uses run ids in the real format and appends them with the real separator', () => {
    for (const id of RUN_IDS) expect(id).toMatch(/^T\d{4}$/)
    expect(DATASETS[0].customerNo).toBe('K-2041 · T4821')
    expect(DATASETS[1].customerNo).toBe('K-2041 · T7306')
  })

  it('carries the exact captions and app copy', () => {
    expect(CAPTIONS.claim.title).toBe('Einmal aufnehmen. Immer ausfüllen.')
    expect(CAPTIONS.problem.title).toBe('12 Felder. Jeder Testlauf. Von Hand.')
    expect(CAPTIONS.fill2.title).toBe('Jedes Mal neue, stimmige Daten.')
    expect(CAPTIONS.outroCopyright.title).toBe('© 2026 Martin Liesche')
    expect(APP.pattern).toBe('https://portal.example.com/*')
  })
})
