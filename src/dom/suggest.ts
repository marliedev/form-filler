import type { DataTypeConfig } from '../model/types'
import { describeElement, type FormControl } from './locator'

interface SuggestRule {
  /** Matched against folded label/name/autocomplete; short keywords (< 5 chars) must equal a whole word. */
  keywords: string[]
  config: DataTypeConfig
}

/** Lowercase, fold umlauts/ß and split camelCase and separators into plain words. */
function fold(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Order matters: more specific rules must precede general ones (e.g. invoice email before email).
const RULES: SuggestRule[] = [
  { keywords: ['rechnungsemail', 'rechnungs email', 'invoice email', 'rechnungspostfach'], config: { type: 'invoiceEmail' } },
  { keywords: ['leitweg'], config: { type: 'leitwegId' } },
  { keywords: ['iban'], config: { type: 'iban' } },
  { keywords: ['bic', 'swift'], config: { type: 'bic' } },
  { keywords: ['bankname', 'bank name', 'kreditinstitut', 'geldinstitut'], config: { type: 'bankName' } },
  { keywords: ['ust id', 'ustid', 'ust idnr', 'umsatzsteuer', 'vat'], config: { type: 'vatId' } },
  { keywords: ['steuernummer', 'steuer nr', 'tax number'], config: { type: 'taxNumber' } },
  { keywords: ['handelsregister', 'hrb'], config: { type: 'tradeRegister' } },
  { keywords: ['rechtsform', 'legal form'], config: { type: 'legalForm' } },
  { keywords: ['branche', 'industry'], config: { type: 'industry' } },
  { keywords: ['anrede', 'salutation', 'honorific prefix'], config: { type: 'salutation' } },
  { keywords: ['vorname', 'first name', 'given name', 'firstname'], config: { type: 'firstName' } },
  { keywords: ['nachname', 'familienname', 'last name', 'family name', 'surname', 'lastname'], config: { type: 'lastName' } },
  { keywords: ['position', 'job title', 'jobtitle', 'funktion', 'organization title'], config: { type: 'jobTitle' } },
  { keywords: ['geburtsdatum', 'geburtstag', 'birth date', 'birthday', 'birthdate', 'bday', 'dob'], config: { type: 'birthDate', minAge: 18 } },
  {
    keywords: ['strasse und hausnummer', 'strasse hausnummer', 'strasse nr', 'street address', 'address line1'],
    config: { type: 'streetWithNumber' },
  },
  { keywords: ['strasse', 'street', 'str'], config: { type: 'streetName' } },
  { keywords: ['hausnummer', 'house number', 'hausnr'], config: { type: 'houseNumber' } },
  { keywords: ['adresszusatz', 'address line2', 'address line 2', 'zusatz'], config: { type: 'addressLine2' } },
  { keywords: ['plz', 'postleitzahl', 'zip', 'postal', 'postcode'], config: { type: 'zip' } },
  { keywords: ['ort', 'stadt', 'city', 'town', 'address level2'], config: { type: 'city' } },
  { keywords: ['land', 'country'], config: { type: 'country' } },
  { keywords: ['firmenname', 'firma', 'unternehmen', 'company', 'organization', 'organisation'], config: { type: 'companyName' } },
  { keywords: ['mobil', 'handy', 'mobile', 'cell'], config: { type: 'mobile' } },
  { keywords: ['telefon', 'phone', 'tel', 'fon'], config: { type: 'phone' } },
  { keywords: ['email', 'e mail', 'mail'], config: { type: 'email' } },
  { keywords: ['website', 'webseite', 'homepage', 'url'], config: { type: 'website' } },
  { keywords: ['kostenstelle', 'cost center', 'costcenter', 'cost centre'], config: { type: 'list', values: [] } },
  {
    keywords: ['kundennummer', 'kunden nr', 'kundennr', 'customer number', 'customer no', 'mandantennummer'],
    config: { type: 'pattern', pattern: 'TEST-{zahl:6}' },
  },
]

const INPUT_TYPE_FALLBACK: Record<string, DataTypeConfig> = {
  email: { type: 'email' },
  tel: { type: 'phone' },
  url: { type: 'website' },
}

function matches(haystack: string, keyword: string): boolean {
  const kw = fold(keyword)
  if (kw.length >= 5 || kw.includes(' ')) return haystack.includes(kw)
  return haystack.split(' ').includes(kw)
}

function clone(config: DataTypeConfig): DataTypeConfig {
  return structuredClone(config)
}

function findRule(sources: (string | null | undefined)[]): SuggestRule | undefined {
  const haystack = fold(sources.filter((s): s is string => !!s).join(' '))
  return haystack ? RULES.find((r) => r.keywords.some((k) => matches(haystack, k))) : undefined
}

/** Throws (via describeElement) for elements that are not a supported form control. */
export function suggestDataType(el: FormControl): DataTypeConfig {
  const loc = describeElement(el)
  if (loc.kind === 'checkbox') return { type: 'checkbox', checked: true }
  // One fixed value, so "Passwort" and "Passwort wiederholen" end up equal.
  if (loc.inputType === 'password') return { type: 'fixed', value: 'Test1234!' }

  // The visible label is the strongest signal; name/autocomplete only decide when it yields nothing.
  const rule =
    findRule([loc.label, loc.ariaLabel]) ?? findRule([loc.name, el.getAttribute('autocomplete')])

  if (loc.kind === 'date') return rule?.config.type === 'birthDate' ? clone(rule.config) : { type: 'date', range: 'past' }
  if (rule) return clone(rule.config)

  const byInputType = loc.inputType ? INPUT_TYPE_FALLBACK[loc.inputType] : undefined
  if (byInputType) return clone(byInputType)
  if (loc.kind === 'select' || loc.kind === 'radiogroup' || loc.kind === 'combobox') {
    return { type: 'choice', mode: 'random', values: [] }
  }
  return { type: 'text' }
}
