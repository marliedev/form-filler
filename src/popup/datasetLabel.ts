import type { Dataset } from '../generators/dataset'

/** One line that identifies the tab's test data: run id, company and the first person. */
export function describeDataset(ds: Dataset): string {
  const person = ds.persons['1']
  const parts = [ds.runId, ds.company.name]
  if (person) parts.push(`${person.firstName} ${person.lastName}`)
  return parts.join(' · ')
}
