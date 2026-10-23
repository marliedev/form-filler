import type { Faker } from '@faker-js/faker'

export interface Bank {
  name: string
  bic: string
}

/** Real German banks with their BIC, so forms that check the BIC format or its country accept the pair. */
export const BANKS: readonly Bank[] = [
  { name: 'Sparkasse KölnBonn', bic: 'COLSDE33XXX' },
  { name: 'Commerzbank', bic: 'COBADEFFXXX' },
  { name: 'Deutsche Bank', bic: 'DEUTDEFFXXX' },
  { name: 'Stadtsparkasse Düsseldorf', bic: 'DUSSDEDDXXX' },
  { name: 'Postbank', bic: 'PBNKDEFFXXX' },
  { name: 'Stadtsparkasse München', bic: 'SSKMDEMMXXX' },
  { name: 'Hamburger Sparkasse', bic: 'HASPDEHHXXX' },
  { name: 'Berliner Volksbank', bic: 'BEVODEBBXXX' },
  { name: 'DKB', bic: 'BYLADEM1001' },
  { name: 'ING', bic: 'INGDDEFFXXX' },
]

export function pickBank(f: Faker): Bank {
  return f.helpers.arrayElement(BANKS)
}
