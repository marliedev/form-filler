import type { Faker } from '@faker-js/faker'
import plz from '../data/plz-de.json'
import type { Template } from '../model/types'
import { slotKindFor } from './catalog'
import { createLeitwegId, createVatId } from './checksums'

export interface Address { street: string; houseNumber: string; zip: string; city: string; country: 'Deutschland'; line2: string }
export interface Person { salutation: 'Herr' | 'Frau'; firstName: string; lastName: string; birthDate: string; jobTitle: string; email: string; phone: string; mobile: string }
export interface Company { name: string; legalForm: string; domain: string; industry: string; vatId: string; taxNumber: string; tradeRegister: string; iban: string; bic: string; bankName: string; leitwegId: string; phone: string }
export interface Dataset { runId: string; createdAt: string; company: Company; persons: Record<string, Person>; addresses: Record<string, Address> }

const LEGAL_FORMS = ['GmbH', 'AG', 'KG', 'GmbH & Co. KG', 'e. K.', 'UG (haftungsbeschränkt)']
const INDUSTRIES = [
  'Logistik', 'Metallbau', 'Software', 'Consulting', 'Handels', 'Bau', 'Elektro', 'Maschinenbau',
  'Immobilien', 'Medien', 'Energie', 'Transport', 'Gastro', 'Textil', 'Pharma', 'Verpackung',
  'Sicherheitstechnik', 'Datentechnik', 'Gebäudeservice', 'Umwelttechnik', 'Fahrzeugtechnik',
  'Werbung', 'Agrar', 'Kältetechnik', 'Personal', 'Steuerberatung', 'Anlagenbau', 'Reinigung',
]
const BANKS = [
  'Sparkasse Köln Bonn', 'Commerzbank', 'Deutsche Bank', 'Volksbank Rhein-Ruhr', 'Postbank',
  'Stadtsparkasse München', 'Hamburger Sparkasse', 'Berliner Volksbank', 'DKB', 'ING-DiBa',
]
const LINE2 = ['Hinterhaus', 'Gebäude 2', '2. Etage', 'Haus B', 'Eingang Nord', '3. OG', 'Aufgang C']
const JOB_TITLES = [
  'Geschäftsführer', 'Einkaufsleiter', 'Buchhalterin', 'Vertriebsleiter', 'Projektmanagerin',
  'IT-Leiter', 'Personalreferentin', 'Assistenz der Geschäftsleitung', 'Teamleiter', 'Controllerin',
]

function pick<T>(f: Faker, list: readonly T[]): T {
  return f.helpers.arrayElement(list)
}

/** Faker-derived [0,1) source so seeding keeps the checksum generators deterministic. */
function randFrom(f: Faker): () => number {
  return () => Math.min(f.number.float({ min: 0, max: 1 }), 0.999999)
}

function digits(f: Faker, length: number): string {
  return f.string.numeric({ length, allowLeadingZeros: true })
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createAddress(f: Faker): Address {
  const [zip, city] = pick(f, plz as [string, string][])
  return {
    street: f.location.street(),
    houseNumber: f.location.buildingNumber(),
    zip,
    city,
    country: 'Deutschland',
    line2: pick(f, LINE2),
  }
}

function createPerson(f: Faker, domain: string): Person {
  const sex = f.person.sexType()
  const firstName = f.person.firstName(sex)
  const lastName = f.person.lastName(sex)
  const area = f.string.numeric({ length: 3, allowLeadingZeros: false })
  return {
    salutation: sex === 'female' ? 'Frau' : 'Herr',
    firstName,
    lastName,
    birthDate: f.date.birthdate({ mode: 'age', min: 25, max: 62 }).toISOString().slice(0, 10),
    jobTitle: pick(f, JOB_TITLES),
    email: `${slugify(firstName)}.${slugify(lastName)}@${domain}`,
    phone: `0${area} ${digits(f, 7)}`,
    mobile: `01${pick(f, ['51', '52', '57', '60', '62', '70', '75', '76'])} ${digits(f, 7)}`,
  }
}

function createCompany(f: Faker, lastName: string): Company {
  const industry = pick(f, INDUSTRIES)
  const legalForm = pick(f, LEGAL_FORMS)
  const rand = randFrom(f)
  return {
    name: `${lastName} ${industry} ${legalForm}`,
    legalForm,
    domain: `${slugify(`${lastName} ${industry}`)}.de`,
    industry,
    vatId: createVatId(rand),
    taxNumber: `${digits(f, 3)}/${digits(f, 4)}/${digits(f, 4)}`,
    tradeRegister: `HRB ${f.string.numeric({ length: { min: 4, max: 6 }, allowLeadingZeros: false })}`,
    iban: f.finance.iban({ formatted: false, countryCode: 'DE' }),
    bic: f.finance.bic(),
    bankName: pick(f, BANKS),
    leitwegId: createLeitwegId(rand),
    phone: `0${f.string.numeric({ length: 3, allowLeadingZeros: false })} ${digits(f, 7)}`,
  }
}

export function createDataset(f: Faker): Dataset {
  const company = createCompany(f, f.person.lastName())
  return {
    runId: `T${f.string.numeric({ length: 4, allowLeadingZeros: true })}`,
    createdAt: new Date().toISOString(),
    company,
    persons: { '1': createPerson(f, company.domain) },
    addresses: { A: createAddress(f) },
  }
}

/** Pure: returns a copy with every person/address slot the template uses. */
export function ensureSlots(ds: Dataset, t: Template, f: Faker): Dataset {
  const persons = { ...ds.persons }
  const addresses = { ...ds.addresses }
  for (const field of t.fields) {
    const kind = slotKindFor(field.config)
    if (kind === 'person') {
      const slot = field.slot ?? '1'
      persons[slot] ??= createPerson(f, ds.company.domain)
    } else if (kind === 'address') {
      const slot = field.slot ?? 'A'
      addresses[slot] ??= createAddress(f)
    }
  }
  return { ...ds, persons, addresses }
}
