import { z } from 'zod';
import type { ExportFile, SimpleTypeId } from './types';

const controlKind = z.enum(['text', 'textarea', 'select', 'radiogroup', 'checkbox', 'date', 'combobox']);

const locator = z.object({
  kind: controlKind,
  name: z.string().optional(),
  id: z.string().optional(),
  label: z.string().optional(),
  ariaLabel: z.string().optional(),
  placeholder: z.string().optional(),
  inputType: z.string().optional(),
});

// Tuple typed against SimpleTypeId so a drift from types.ts fails the compile.
const simpleTypeIds = [
  'companyName', 'legalForm', 'vatId', 'taxNumber', 'tradeRegister', 'industry',
  'salutation', 'firstName', 'lastName', 'jobTitle',
  'streetWithNumber', 'streetName', 'houseNumber', 'zip', 'city', 'country', 'addressLine2',
  'email', 'phone', 'mobile', 'website',
  'iban', 'bic', 'bankName',
  'invoiceEmail', 'leitwegId', 'text',
] as const satisfies readonly SimpleTypeId[];

const simpleConfig = z.object({ type: z.enum(simpleTypeIds) });

const config = z.union([
  simpleConfig,
  z.object({ type: z.literal('birthDate'), minAge: z.number() }),
  z.object({
    type: z.literal('date'),
    range: z.enum(['past', 'future', 'between']),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  z.object({ type: z.literal('number'), min: z.number(), max: z.number() }),
  z.object({ type: z.literal('fixed'), value: z.string() }),
  z.object({
    type: z.literal('choice'),
    mode: z.enum(['random', 'subset', 'fixed']),
    values: z.array(z.string()),
  }),
  z.object({ type: z.literal('checkbox'), checked: z.union([z.boolean(), z.literal('random')]) }),
  z.object({ type: z.literal('list'), values: z.array(z.string()) }),
  z.object({ type: z.literal('pattern'), pattern: z.string() }),
  z.object({ type: z.literal('empty') }),
]);

const fieldRule = z.object({
  id: z.string(),
  label: z.string(),
  locator,
  config,
  slot: z.string().nullable(),
  required: z.boolean(),
  appendRunId: z.boolean(),
});

const template = z.object({
  id: z.string(),
  appId: z.string(),
  name: z.string(),
  process: z.object({ name: z.string(), step: z.number() }).nullable(),
  fields: z.array(fieldRule),
  lastMissing: z.array(z.string()),
});

const appDef = z.object({
  id: z.string(),
  name: z.string(),
  urlPatterns: z.array(z.string()),
});

const exportFile = z.object({
  format: z.literal('form-filler'),
  version: z.literal(1),
  apps: z.array(appDef),
  templates: z.array(template),
}) satisfies z.ZodType<ExportFile>;

export type ParseExportResult = { ok: true; data: ExportFile } | { ok: false; error: string };

export function parseExport(json: string): ParseExportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }

  const result = exportFile.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  const details = result.error.issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
  return { ok: false, error: `Ungültige Export-Datei (${details}).` };
}

export function buildExport(apps: ExportFile['apps'], templates: ExportFile['templates']): string {
  const file: ExportFile = { format: 'form-filler', version: 1, apps, templates };
  return JSON.stringify(file, null, 2);
}
