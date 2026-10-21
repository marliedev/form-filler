/** Maps digits and letters to their numeric value (A=10 … Z=35) for MOD 97 checks. */
function toNumericString(value: string): string {
  let out = ''
  for (const ch of value.toUpperCase()) {
    out += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
  }
  return out
}

export function isValidIban(iban: string): boolean {
  const compact = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false
  const rearranged = compact.slice(4) + compact.slice(0, 4)
  return BigInt(toNumericString(rearranged)) % 97n === 1n
}

/** ISO 7064 MOD 11,10 check digit of the first 8 digits of a German VAT id. */
export function vatIdCheckDigit(first8: string): number {
  let product = 10
  for (const ch of first8) {
    const sum = (Number(ch) + product) % 10 || 10
    product = (2 * sum) % 11
  }
  const digit = 11 - product
  return digit === 10 ? 0 : digit
}

function randomDigits(rand: () => number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += String(Math.floor(rand() * 10))
  return out
}

export function createVatId(rand: () => number): string {
  const first = String(1 + Math.floor(rand() * 9))
  const first8 = first + randomDigits(rand, 7)
  return `DE${first8}${vatIdCheckDigit(first8)}`
}

/** ISO 7064 MOD 97-10 check digits over a Leitweg-ID body (hyphens removed). */
export function leitwegCheckDigits(body: string): string {
  const n = BigInt(toNumericString(body) + '00')
  return String(98n - (n % 97n)).padStart(2, '0')
}

export function createLeitwegId(rand: () => number): string {
  const coarse = randomDigits(rand, 8)
  const fine = randomDigits(rand, 10)
  return `${coarse}-${fine}-${leitwegCheckDigits(coarse + fine)}`
}
