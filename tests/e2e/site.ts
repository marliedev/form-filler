/* App and templates matching the local test site (`npm run test-site`), written the way the
   recorder would store them. Labels are normalized (lowercase, no trailing '*') like the locator does. */
import type { AppDef, DataTypeConfig, FieldLocator, FieldRule, Template } from '../../src/model/types'
import { SITE_URL } from './fixtures'

export const APP: AppDef = { id: 'app-site', name: 'Testseite', urlPatterns: [`${SITE_URL}/*`] }
export const PROCESS = 'Kundenanlage'

type RuleOptions = Partial<Pick<FieldRule, 'slot' | 'required' | 'appendRunId'>>

function rule(id: string, label: string, locator: FieldLocator, config: DataTypeConfig, options: RuleOptions = {}): FieldRule {
  return { id, label, locator, config, slot: null, required: false, appendRunId: false, ...options }
}

const text = (name: string, id: string, label: string): FieldLocator => ({ kind: 'text', name, id, label, inputType: 'text' })

export const COMPANY = rule('f-company', 'Firmenname', text('company', 'company', 'firmenname'), { type: 'companyName' }, { required: true, appendRunId: true })

const STEP1_FIELDS: FieldRule[] = [
  COMPANY,
  rule('f-customer-no', 'Kundennummer', text('customer_no', 'customer-no', 'kundennummer'), { type: 'pattern', pattern: 'K-{zahl:4}' }),
  rule('f-notes', 'Bemerkung', { kind: 'textarea', name: 'notes', id: 'notes', label: 'bemerkung' }, { type: 'text' }),
  rule('f-start-date', 'Startdatum', { kind: 'date', name: 'start_date', id: 'start-date', label: 'startdatum', inputType: 'date' }, { type: 'date', range: 'future' }),
  rule('f-birth-date', 'Geburtsdatum', { ...text('birth_date', 'birth-date', 'geburtsdatum'), placeholder: 'tt.mm.jjjj' }, { type: 'birthDate', minAge: 18 }, { slot: '1' }),
  rule('f-industry', 'Branche', { kind: 'select', name: 'industry', id: 'industry', label: 'branche' }, { type: 'choice', mode: 'random', values: [] }),
  rule('f-role', 'Rolle', { kind: 'radiogroup', name: 'role', label: 'rolle' }, { type: 'choice', mode: 'fixed', values: ['Lernmanager'] }),
  rule('f-country', 'Land', { kind: 'combobox', label: 'land' }, { type: 'country' }, { slot: 'A' }),
  rule('f-topic', 'Anliegen', { kind: 'combobox', id: 'topic', label: 'anliegen' }, { type: 'choice', mode: 'fixed', values: ['Presse'] }, { required: true }),
  rule('f-street', 'Straße', text('street', 'street', 'straße'), { type: 'streetWithNumber' }, { slot: 'A', required: true }),
  rule('f-zip', 'PLZ', text('zip', 'zip', 'plz'), { type: 'zip' }, { slot: 'A', required: true }),
  rule('f-city', 'Ort', text('city', 'city', 'ort'), { type: 'city' }, { slot: 'A', required: true }),
  // Checking the box renders the billing fieldset (v-if); the fields after it only exist from then on.
  rule('f-billing-differs', 'Rechnungsadresse abweichend', { kind: 'checkbox', name: 'billing_differs', label: 'rechnungsadresse abweichend', inputType: 'checkbox' }, { type: 'checkbox', checked: true }),
  rule('f-billing-street', 'Rechnung: Straße', text('billing_street', 'billing-street', 'straße'), { type: 'streetWithNumber' }, { slot: 'B' }),
  rule('f-billing-zip', 'Rechnung: PLZ', text('billing_zip', 'billing-zip', 'plz'), { type: 'zip' }, { slot: 'B' }),
  rule('f-billing-city', 'Rechnung: Ort', text('billing_city', 'billing-city', 'ort'), { type: 'city' }, { slot: 'B' }),
]

const STEP2_FIELDS: FieldRule[] = [
  rule('f-contact-first-name', 'Vorname', text('contact_first_name', 'contact-first-name', 'vorname'), { type: 'firstName' }, { slot: '1' }),
  rule('f-contact-email', 'E-Mail', { ...text('contact_email', 'contact-email', 'e-mail'), inputType: 'email' }, { type: 'email' }, { slot: '1' }),
]

function template(id: string, name: string, fields: FieldRule[], step: number | null): Template {
  return { id, appId: APP.id, name, process: step === null ? null : { name: PROCESS, step }, fields, lastMissing: [] }
}

export const STEP1 = template('tpl-step1', 'Schritt 1', STEP1_FIELDS, 1)
export const STEP2 = template('tpl-step2', 'Schritt 2', STEP2_FIELDS, 2)
/** The test site has no phone field, so the second rule cannot be found. */
export const WITH_MISSING = template(
  'tpl-missing',
  'Mit fehlendem Feld',
  [COMPANY, rule('f-phone', 'Telefon', text('phone', 'phone', 'telefon'), { type: 'phone' }, { slot: '1' })],
  null,
)
export const EMPTY = template('tpl-empty', 'Aufnahme', [], null)

/** Fields inside the test site's web components and its same-origin delivery frame; the main-document zip proves the tie-break. */
const DEEP_FIELDS: FieldRule[] = [
  rule('f-cost-center', 'Kostenstelle', { kind: 'text', name: 'cost_center', id: 'input', label: 'kostenstelle', inputType: 'text', scope: ['wc-text-field'] }, { type: 'pattern', pattern: 'KST-{zahl:4}' }),
  rule('f-po-number', 'Bestellnummer', { kind: 'text', name: 'po_number', label: 'bestellnummer', inputType: 'text', scope: ['wc-input#po-number'] }, { type: 'pattern', pattern: 'PO-{zahl:5}' }),
  rule('f-delivery-street', 'Lieferung: Straße', { ...text('street', 'street', 'straße'), scope: ['iframe:delivery'] }, { type: 'streetWithNumber' }, { slot: 'B' }),
  rule('f-delivery-zip', 'Lieferung: PLZ', { ...text('zip', 'zip', 'plz'), scope: ['iframe:delivery'] }, { type: 'zip' }, { slot: 'B' }),
  rule('f-delivery-city', 'Lieferung: Ort', { ...text('city', 'city', 'ort'), scope: ['iframe:delivery'] }, { type: 'city' }, { slot: 'B' }),
  rule('f-delivery-carrier', 'Lieferung: Versanddienst', { kind: 'select', name: 'carrier', id: 'carrier', label: 'versanddienst', scope: ['iframe:delivery'] }, { type: 'choice', mode: 'fixed', values: ['DPD'] }),
  rule('f-main-zip', 'PLZ', text('zip', 'zip', 'plz'), { type: 'zip' }, { slot: 'A' }),
]
export const DEEP = template('tpl-deep', 'Komponenten und Rahmen', DEEP_FIELDS, null)
