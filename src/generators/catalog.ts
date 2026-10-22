import type { ControlKind, DataTypeConfig } from '../model/types'

export type SlotKind = 'person' | 'address'

export type DataTypeGroup =
  | 'Firma' | 'Person' | 'Adresse' | 'Kontakt' | 'Bank' | 'E-Rechnung' | 'Allgemein' | 'Steuerung'

export interface DataTypeMeta {
  type: DataTypeConfig['type']
  label: string
  group: DataTypeGroup
  slotKind: SlotKind | null
  /** Control kinds the type sensibly applies to; used to filter the type picker. */
  controls: ControlKind[]
}

const TEXT: ControlKind[] = ['text', 'textarea', 'combobox']
const TEXT_OR_CHOICE: ControlKind[] = ['text', 'textarea', 'combobox', 'select', 'radiogroup']
const CHOICE: ControlKind[] = ['select', 'radiogroup', 'combobox']

function meta(
  type: DataTypeMeta['type'],
  label: string,
  group: DataTypeGroup,
  controls: ControlKind[],
  slotKind: SlotKind | null = null,
): DataTypeMeta {
  return { type, label, group, slotKind, controls }
}

export const DATA_TYPES: readonly DataTypeMeta[] = [
  meta('companyName', 'Firmenname', 'Firma', TEXT),
  meta('legalForm', 'Rechtsform', 'Firma', TEXT_OR_CHOICE),
  meta('vatId', 'USt-IdNr.', 'Firma', TEXT),
  meta('taxNumber', 'Steuernummer', 'Firma', TEXT),
  meta('tradeRegister', 'Handelsregister-Nr.', 'Firma', TEXT),
  meta('industry', 'Branche', 'Firma', TEXT_OR_CHOICE),

  meta('salutation', 'Anrede', 'Person', TEXT_OR_CHOICE, 'person'),
  meta('firstName', 'Vorname', 'Person', TEXT, 'person'),
  meta('lastName', 'Nachname', 'Person', TEXT, 'person'),
  meta('birthDate', 'Geburtsdatum', 'Person', ['text', 'date'], 'person'),
  meta('jobTitle', 'Position', 'Person', TEXT_OR_CHOICE, 'person'),

  meta('streetWithNumber', 'Straße + Hausnummer', 'Adresse', TEXT, 'address'),
  meta('streetName', 'Straße', 'Adresse', TEXT, 'address'),
  meta('houseNumber', 'Hausnummer', 'Adresse', TEXT, 'address'),
  meta('zip', 'PLZ', 'Adresse', TEXT, 'address'),
  meta('city', 'Ort', 'Adresse', TEXT, 'address'),
  meta('country', 'Land', 'Adresse', TEXT_OR_CHOICE, 'address'),
  meta('addressLine2', 'Adresszusatz', 'Adresse', TEXT, 'address'),

  meta('email', 'E-Mail', 'Kontakt', TEXT, 'person'),
  meta('phone', 'Telefon', 'Kontakt', TEXT, 'person'),
  meta('mobile', 'Mobilnummer', 'Kontakt', TEXT, 'person'),
  meta('website', 'Website', 'Kontakt', TEXT),

  meta('iban', 'IBAN', 'Bank', TEXT),
  meta('bic', 'BIC', 'Bank', TEXT),
  meta('bankName', 'Bankname', 'Bank', TEXT),

  meta('invoiceEmail', 'Rechnungspostfach (E-Mail)', 'E-Rechnung', TEXT),
  meta('leitwegId', 'Leitweg-ID', 'E-Rechnung', TEXT),

  meta('date', 'Datum', 'Allgemein', ['text', 'date']),
  meta('number', 'Zahl', 'Allgemein', TEXT),
  meta('text', 'Freitext / Notiz', 'Allgemein', ['text', 'textarea']),

  meta('fixed', 'Festwert', 'Steuerung', TEXT_OR_CHOICE),
  meta('choice', 'Auswahl', 'Steuerung', CHOICE),
  meta('checkbox', 'Checkbox', 'Steuerung', ['checkbox']),
  meta('list', 'Aus Liste', 'Steuerung', TEXT_OR_CHOICE),
  meta('pattern', 'Muster', 'Steuerung', TEXT),
  meta('empty', 'Leer lassen', 'Steuerung', ['text', 'textarea', 'select', 'radiogroup', 'checkbox', 'date', 'combobox']),
]

const SLOT_KIND_BY_TYPE: ReadonlyMap<string, SlotKind | null> = new Map(
  DATA_TYPES.map((d) => [d.type, d.slotKind]),
)

/** Which slot family (person '1','2'… or address 'A','B'…) a data type draws from. */
export function slotKindFor(config: DataTypeConfig): SlotKind | null {
  return SLOT_KIND_BY_TYPE.get(config.type) ?? null
}
