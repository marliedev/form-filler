import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const input = process.argv[2]
if (!input) {
  console.error('Usage: tsx scripts/build-plz.ts <path to GeoNames DE.txt>')
  process.exit(1)
}

const output = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/plz-de.json')

const seen = new Set<string>()
const rows: [string, string][] = []

for (const line of readFileSync(input, 'utf8').split('\n')) {
  const cols = line.split('\t')
  const zip = cols[1]
  const city = cols[2]
  const stateCode = cols[4]
  if (!zip || !city || !/^\d{5}$/.test(zip)) continue
  // Numeric state codes mark GeoNames' large-customer entries (companies, authorities)
  // whose "place name" is not a city; real places carry an alphabetic state code.
  if (!stateCode || /^\d+$/.test(stateCode)) continue
  const key = `${zip}\t${city}`
  if (seen.has(key)) continue
  seen.add(key)
  rows.push([zip, city])
}

rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1], 'de'))
writeFileSync(output, JSON.stringify(rows) + '\n')
console.log(`Wrote ${rows.length} rows to ${output}`)
