import { fakerDE } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { createDataset, type Dataset } from '../../src/generators/dataset'
import { describeDataset } from '../../src/popup/datasetLabel'

function dataset(): Dataset {
  const ds = createDataset(fakerDE)
  const person = ds.persons['1']
  if (!person) throw new Error('createDataset must create person 1')
  return {
    ...ds,
    runId: 'T4821',
    company: { ...ds.company, name: 'Nordlicht Medien GmbH' },
    persons: { '1': { ...person, firstName: 'Anna', lastName: 'Brandt' } },
  }
}

describe('describeDataset', () => {
  it('joins run id, company and the first person', () => {
    expect(describeDataset(dataset())).toBe('T4821 · Nordlicht Medien GmbH · Anna Brandt')
  })

  it('leaves the person out when slot 1 is missing', () => {
    expect(describeDataset({ ...dataset(), persons: {} })).toBe('T4821 · Nordlicht Medien GmbH')
  })
})
