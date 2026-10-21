import type { DataTypeConfig } from '../model/types'

const WITH_OPTIONS: ReadonlySet<DataTypeConfig['type']> = new Set([
  'fixed', 'choice', 'list', 'pattern', 'date', 'number', 'birthDate', 'checkbox',
])

/** Whether `ConfigEditor` shows any inputs for the type. */
export function hasOptions(type: DataTypeConfig['type']): boolean {
  return WITH_OPTIONS.has(type)
}
