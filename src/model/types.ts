export type ControlKind = 'text' | 'textarea' | 'select' | 'radiogroup' | 'checkbox' | 'date' | 'combobox';

export interface FieldLocator {
  kind: ControlKind;
  name?: string;
  id?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  inputType?: string;
  /** Boundaries from the top document to the field (`iframe:<name>`, `<tag>#<id>`); absent for the main document. */
  scope?: string[];
}

export type SimpleTypeId =
  | 'companyName' | 'legalForm' | 'vatId' | 'taxNumber' | 'tradeRegister' | 'industry'
  | 'salutation' | 'firstName' | 'lastName' | 'jobTitle'
  | 'streetWithNumber' | 'streetName' | 'houseNumber' | 'zip' | 'city' | 'country' | 'addressLine2'
  | 'email' | 'phone' | 'mobile' | 'website'
  | 'iban' | 'bic' | 'bankName'
  | 'invoiceEmail' | 'leitwegId' | 'text';

export type DataTypeConfig =
  | { type: SimpleTypeId }
  | { type: 'birthDate'; minAge: number }
  | { type: 'date'; range: 'past' | 'future' | 'between'; from?: string; to?: string } // ISO dates
  | { type: 'number'; min: number; max: number }
  | { type: 'fixed'; value: string }
  | { type: 'choice'; mode: 'random' | 'subset' | 'fixed'; values: string[] }
  | { type: 'checkbox'; checked: boolean | 'random' }
  | { type: 'list'; values: string[] }
  | { type: 'pattern'; pattern: string }
  | { type: 'empty' };

export interface FieldRule {
  id: string;
  label: string;
  locator: FieldLocator;
  config: DataTypeConfig;
  /** Person '1','2',… / address 'A','B',…; null for company/general data. */
  slot: string | null;
  required: boolean;
  appendRunId: boolean;
}

export interface Template {
  id: string;
  appId: string;
  name: string;
  process: { name: string; step: number } | null;
  /** Array order is the fill order. */
  fields: FieldRule[];
  /** FieldRule ids not found/filled on the last run. */
  lastMissing: string[];
  /** Set on templates synced from the app's source: the template's id in the file and the fingerprint of that version. */
  source?: { templateId: string; fingerprint: string };
}

/** `urlPatterns` use '*' as wildcard. */
export interface AppDef {
  id: string;
  name: string;
  urlPatterns: string[];
  /** Address of the team's export file; `appId` is the matching app in that file, null until the first sync mapped it. */
  source?: { url: string; appId: string | null };
}

export interface ExportFile {
  format: 'form-filler';
  version: 1;
  apps: AppDef[];
  templates: Template[];
}

export interface Prefs {
  mode: 'all' | 'required';
  lastTemplateId: string | null;
}
