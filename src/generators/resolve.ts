import type { Faker } from '@faker-js/faker'
import type { FieldRule } from '../model/types'
import type { Address, Dataset, Person } from './dataset'
import { expandPattern } from './pattern'

export type FieldValue =
  | { kind: 'text'; value: string }
  | { kind: 'date'; iso: string }
  | { kind: 'choice'; mode: 'random' | 'subset' | 'fixed'; values: string[] }
  | { kind: 'checkbox'; checked: boolean }
  | { kind: 'skip' }

const RUN_ID_SEPARATOR = ' · '

/** Appends the run id; shortens the base value (never the id) to honor maxLength, dropping the id if it cannot fit. */
export function applyRunId(value: string, runId: string, maxLength: number | null): string {
  const suffix = `${RUN_ID_SEPARATOR}${runId}`
  if (maxLength === null || value.length + suffix.length <= maxLength) return `${value}${suffix}`
  const base = value.slice(0, maxLength - suffix.length).trimEnd()
  return base.length > 0 ? `${base}${suffix}` : value
}

const text = (value: string): FieldValue => ({ kind: 'text', value })

function person(ds: Dataset, slot: string): Person {
  const p = ds.persons[slot]
  if (!p) throw new Error(`Dataset has no person slot "${slot}"; call ensureSlots first`)
  return p
}

function address(ds: Dataset, slot: string): Address {
  const a = ds.addresses[slot]
  if (!a) throw new Error(`Dataset has no address slot "${slot}"; call ensureSlots first`)
  return a
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function resolveBase(rule: FieldRule, ds: Dataset, f: Faker): FieldValue {
  const c = rule.config
  const p = () => person(ds, rule.slot ?? '1')
  const a = () => address(ds, rule.slot ?? 'A')

  switch (c.type) {
    case 'companyName': return text(ds.company.name)
    case 'legalForm': return text(ds.company.legalForm)
    case 'vatId': return text(ds.company.vatId)
    case 'taxNumber': return text(ds.company.taxNumber)
    case 'tradeRegister': return text(ds.company.tradeRegister)
    case 'industry': return text(ds.company.industry)
    case 'iban': return text(ds.company.iban)
    case 'bic': return text(ds.company.bic)
    case 'bankName': return text(ds.company.bankName)
    case 'leitwegId': return text(ds.company.leitwegId)
    case 'website': return text(`https://www.${ds.company.domain}`)
    case 'invoiceEmail': return text(`rechnung@${ds.company.domain}`)

    // Choice (not text) so dropdowns and radios select the matching option.
    case 'salutation': return { kind: 'choice', mode: 'fixed', values: [p().salutation] }
    case 'firstName': return text(p().firstName)
    case 'lastName': return text(p().lastName)
    case 'jobTitle': return text(p().jobTitle)
    case 'email': return text(p().email)
    case 'phone': return text(p().phone)
    case 'mobile': return text(p().mobile)
    case 'birthDate': {
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - c.minAge)
      const own = p().birthDate
      if (own <= isoDate(cutoff)) return { kind: 'date', iso: own }
      return { kind: 'date', iso: isoDate(f.date.birthdate({ mode: 'age', min: c.minAge, max: c.minAge + 40 })) }
    }

    case 'streetWithNumber': return text(`${a().street} ${a().houseNumber}`)
    case 'streetName': return text(a().street)
    case 'houseNumber': return text(a().houseNumber)
    case 'zip': return text(a().zip)
    case 'city': return text(a().city)
    case 'country': return text(a().country)
    case 'addressLine2': return text(a().line2)

    case 'text': return text(f.lorem.sentence({ min: 3, max: 6 }))
    case 'number': return text(String(f.number.int({ min: c.min, max: c.max })))
    case 'date': {
      if (c.range === 'past') return { kind: 'date', iso: isoDate(f.date.past({ years: 5 })) }
      if (c.range === 'future') return { kind: 'date', iso: isoDate(f.date.future({ years: 2 })) }
      const from = c.from ?? isoDate(f.date.past({ years: 1 }))
      const to = c.to ?? isoDate(f.date.future({ years: 1 }))
      return { kind: 'date', iso: isoDate(f.date.between({ from, to })) }
    }

    case 'fixed': return text(c.value)
    case 'choice': return { kind: 'choice', mode: c.mode, values: [...c.values] }
    case 'checkbox': return { kind: 'checkbox', checked: c.checked === 'random' ? f.datatype.boolean() : c.checked }
    case 'list': return c.values.length > 0 ? text(f.helpers.arrayElement(c.values)) : { kind: 'skip' }
    case 'pattern': return text(expandPattern(c.pattern, ds.runId, f))
    case 'empty': return { kind: 'skip' }
  }
}

/** Callers must run `ensureSlots` first; a missing person/address slot is a programming error and throws. */
export function resolveValue(rule: FieldRule, ds: Dataset, f: Faker): FieldValue {
  const value = resolveBase(rule, ds, f)
  if (rule.appendRunId && value.kind === 'text') {
    return text(applyRunId(value.value, ds.runId, null))
  }
  return value
}
