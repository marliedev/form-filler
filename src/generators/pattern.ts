import type { Faker } from '@faker-js/faker'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const PLACEHOLDER = /\{(?:(zahl|buchstabe):(\d+)|(kennung)|(datum))\}/g

function today(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${mm}${dd}`
}

/** Unknown placeholders are left untouched so typos stay visible in the filled value. */
export function expandPattern(pattern: string, runId: string, f: Faker): string {
  return pattern.replace(PLACEHOLDER, (_m, kind?: string, count?: string, ident?: string) => {
    if (kind === 'zahl') {
      const n = Number(count)
      return n > 0 ? f.string.numeric({ length: n, allowLeadingZeros: true }) : ''
    }
    if (kind === 'buchstabe') {
      const n = Number(count)
      return Array.from({ length: n }, () => f.helpers.arrayElement([...LETTERS])).join('')
    }
    if (ident) return runId
    return today()
  })
}
