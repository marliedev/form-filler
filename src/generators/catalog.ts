import type { DataTypeConfig } from '../model/types'

export type SlotKind = 'person' | 'address'

const PERSON_TYPES: ReadonlySet<string> = new Set([
  'salutation', 'firstName', 'lastName', 'jobTitle', 'email', 'phone', 'mobile', 'birthDate',
])
const ADDRESS_TYPES: ReadonlySet<string> = new Set([
  'streetWithNumber', 'streetName', 'houseNumber', 'zip', 'city', 'country', 'addressLine2',
])

/** Which slot family (person '1','2'… or address 'A','B'…) a data type draws from. */
export function slotKindFor(config: DataTypeConfig): SlotKind | null {
  if (PERSON_TYPES.has(config.type)) return 'person'
  if (ADDRESS_TYPES.has(config.type)) return 'address'
  return null
}
