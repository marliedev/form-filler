import type { Faker } from '@faker-js/faker'

/* Phone numbers come from the blocks the Bundesnetzagentur reserves for media productions
   ("Drama Numbers"). They are never assigned to subscribers, so test data can never reach a real
   person, and they pass strict format checks. Source: BNetzA, Mitteilung 148/2021. */

interface Range {
  /** Area code plus the fixed part of the block, formatted the way the number is written. */
  prefixes: readonly string[]
  /** Number of random digits that complete the block. */
  digits: number
}

// Berlin, Frankfurt am Main, Hamburg, Köln, München: 1,000 numbers each.
const LANDLINE: Range = { prefixes: ['030 23125', '069 90009', '040 66969', '0221 4710', '089 99998'], digits: 3 }
// Two mobile blocks of 100 numbers each.
const MOBILE: Range = { prefixes: ['0171 39200', '0176 040690'], digits: 2 }

function patternFor(range: Range): RegExp {
  return new RegExp(`^(${range.prefixes.join('|')})\\d{${range.digits}}$`)
}

export const LANDLINE_PATTERN = patternFor(LANDLINE)
export const MOBILE_PATTERN = patternFor(MOBILE)

function create(f: Faker, range: Range): string {
  return `${f.helpers.arrayElement(range.prefixes)}${f.string.numeric({ length: range.digits, allowLeadingZeros: true })}`
}

export function createLandline(f: Faker): string {
  return create(f, LANDLINE)
}

export function createMobile(f: Faker): string {
  return create(f, MOBILE)
}
