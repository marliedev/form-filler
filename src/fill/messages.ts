import type { Dataset } from '../generators/dataset'
import type { FieldRule, Template } from '../model/types'

export type FillMode = 'all' | 'required'

/** Messages the extension sends to the injected content script. */
export type ContentMessage =
  | { type: 'fill'; template: Template; dataset: Dataset; mode: FillMode }
  | { type: 'record:start'; templateId: string }
  | { type: 'scan' }

/** Content script answer to `record:start`. */
export type RecordStartResponse = { ok: true } | { ok: false; error: string }

/** Content script answer to `scan`: the rules the recorder would suggest for every form field. */
export type ScanResponse = { ok: true; fields: FieldRule[] } | { ok: false; error: string }
