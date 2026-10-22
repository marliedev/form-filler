/* Demo content of the promo video. Everything here is invented; the formats follow the extension. */

export const APP = {
  name: 'Kundenportal',
  url: 'https://portal.example.com/kunden/neu',
  pattern: 'https://portal.example.com/*',
  title: 'Kundenanlage',
  subtitle: 'Schritt 1 von 3 · Stammdaten',
  template: 'Kundenanlage',
} as const

export type FieldKey =
  | 'company' | 'salutation' | 'firstName' | 'lastName' | 'email' | 'phone'
  | 'street' | 'zip' | 'city' | 'customerNo' | 'billingEmail' | 'iban'

export interface Field {
  key: FieldKey
  label: string
  required: boolean
  /** Type label as the extension shows it (src/generators/catalog.ts). */
  typeLabel: string
  kind: 'text' | 'select'
}

export const FIELDS: readonly Field[] = [
  { key: 'company', label: 'Firma', required: true, typeLabel: 'Firmenname', kind: 'text' },
  { key: 'salutation', label: 'Anrede', required: true, typeLabel: 'Anrede', kind: 'select' },
  { key: 'firstName', label: 'Vorname', required: true, typeLabel: 'Vorname', kind: 'text' },
  { key: 'lastName', label: 'Nachname', required: true, typeLabel: 'Nachname', kind: 'text' },
  { key: 'email', label: 'E-Mail', required: true, typeLabel: 'E-Mail', kind: 'text' },
  { key: 'phone', label: 'Telefon', required: false, typeLabel: 'Telefon', kind: 'text' },
  { key: 'street', label: 'Straße', required: true, typeLabel: 'Straße + Hausnummer', kind: 'text' },
  { key: 'zip', label: 'PLZ', required: true, typeLabel: 'PLZ', kind: 'text' },
  { key: 'city', label: 'Ort', required: true, typeLabel: 'Ort', kind: 'text' },
  { key: 'customerNo', label: 'Kundennummer', required: true, typeLabel: 'Muster', kind: 'text' },
  { key: 'billingEmail', label: 'Rechnungs-E-Mail', required: false, typeLabel: 'Rechnungspostfach (E-Mail)', kind: 'text' },
  { key: 'iban', label: 'IBAN', required: false, typeLabel: 'IBAN', kind: 'text' },
]

export const RUN_IDS = ['T4821', 'T7306'] as const

export const DATASETS: readonly [Record<FieldKey, string>, Record<FieldKey, string>] = [
  {
    company: 'Nordlicht Medien GmbH',
    salutation: 'Frau',
    firstName: 'Lena',
    lastName: 'Hoffmann',
    email: 'lena.hoffmann@nordlicht-medien.example',
    phone: '0221 2893817',
    street: 'Hohenzollernring 42',
    zip: '50672',
    city: 'Köln',
    customerNo: `K-2041 · ${RUN_IDS[0]}`,
    billingEmail: 'rechnung@nordlicht-medien.example',
    iban: 'DE89 3704 0044 0532 0130 00',
  },
  {
    company: 'Brandt & Söhne KG',
    salutation: 'Herr',
    firstName: 'Jonas',
    lastName: 'Brandt',
    email: 'jonas.brandt@brandt-soehne.example',
    phone: '0341 5587120',
    street: 'Karl-Liebknecht-Straße 18',
    zip: '04107',
    city: 'Leipzig',
    customerNo: `K-2041 · ${RUN_IDS[1]}`,
    billingEmail: 'rechnung@brandt-soehne.example',
    iban: 'DE02 1203 0000 0000 2020 51',
  },
]

export interface Caption {
  title: string
  sub?: string
}

export const CAPTIONS = {
  claim: { title: 'Einmal aufnehmen. Immer ausfüllen.' },
  by: { title: 'developed by' },
  problem: { title: '12 Felder. Jeder Testlauf. Von Hand.' },
  detect1: { title: 'Erkennt die App an der URL.' },
  detect2: { title: 'Einmal anlegen, ab jetzt automatisch.' },
  record1: { title: 'Felder anklicken.', sub: 'Der Datentyp wird vorgeschlagen.' },
  record2: { title: 'Pflichtfelder erkennt sie selbst.' },
  record3: { title: 'Speichern. Fertig.' },
  fill1: { title: 'Ein Klick.' },
  fill2: { title: 'Jedes Mal neue, stimmige Daten.' },
  shortcut: { title: 'Oder per Tastenkürzel.' },
  manage: { title: 'Vorlagen pflegen, exportieren, teilen.' },
  outroRepo: { title: 'github.com/marliedev/form-filler' },
  outroBrowsers: { title: 'Für Dia, Arc, Chrome und andere Chromium-Browser' },
  outroCopyright: { title: '© 2026 Martin Liesche' },
} as const satisfies Record<string, Caption>

export type CaptionKey = keyof typeof CAPTIONS
