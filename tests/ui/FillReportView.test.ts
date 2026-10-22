import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FillReportView from '../../src/ui/FillReportView.vue'

describe('FillReportView', () => {
  it('lists every field with a text status, problems first', () => {
    const w = mount(FillReportView, {
      props: {
        report: {
          templateId: 't',
          filled: 1,
          total: 2,
          fields: [
            { fieldId: 'a', label: 'Firmenname', status: 'filled' },
            { fieldId: 'b', label: 'Rechtsform', status: 'missing', detail: 'Feld nicht gefunden' },
            { fieldId: 'c', label: 'Notiz', status: 'skipped', detail: 'Optional' },
          ],
        },
      },
    })
    const rows = w.findAll('li').map((li) => li.text().replace(/\s+/g, ' '))
    expect(rows).toEqual([
      'Rechtsform: ⚠ nicht gefunden Feld nicht gefunden',
      'Firmenname: ✓ befüllt',
      'Notiz: – übersprungen Optional',
    ])
  })
})
