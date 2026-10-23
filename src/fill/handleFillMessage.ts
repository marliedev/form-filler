import type { Faker } from '@faker-js/faker'
import { z } from 'zod'
import type { Dataset } from '../generators/dataset'
import { templateSchema } from '../model/schema'
import { pageOwnership } from './ownership'
import { runFill, type FillReport } from './runFill'

const fillMessageSchema = z.object({
  type: z.literal('fill'),
  template: templateSchema,
  dataset: z.unknown(),
  mode: z.enum(['all', 'required']),
  continueRun: z.boolean().optional(),
})

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Shallow on purpose: the dataset is produced by the extension itself; this only rejects malformed messages. */
function isDataset(value: unknown): value is Dataset {
  return isObject(value) && typeof value.runId === 'string' && isObject(value.company) && isObject(value.persons) && isObject(value.addresses)
}

function errorReport(templateId: string, error: string): FillReport {
  return { templateId, filled: 0, total: 0, fields: [], error }
}

/** Content side entry for a `fill` message; never throws, problems come back as a report with `error`. */
export async function handleFillMessage(raw: unknown, root: ParentNode, f: Faker): Promise<FillReport> {
  const parsed = fillMessageSchema.safeParse(raw)
  if (!parsed.success || !isDataset(parsed.data.dataset)) {
    const template = isObject(raw) && isObject(raw.template) ? raw.template : {}
    return errorReport(typeof template.id === 'string' ? template.id : '', 'Ungültige Vorlage – Befüllen nicht möglich')
  }
  const { template, dataset, mode, continueRun } = parsed.data
  try {
    return await runFill(root, template, dataset, mode, f, pageOwnership(), continueRun ?? false)
  } catch (e) {
    return errorReport(template.id, e instanceof Error ? e.message : String(e))
  }
}
