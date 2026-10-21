import type { Dataset } from '../generators/dataset'
import type { Template } from '../model/types'

export type FillMode = 'all' | 'required'

/** Messages the extension sends to the injected content script. */
export type ContentMessage =
  | { type: 'fill'; template: Template; dataset: Dataset; mode: FillMode }
  | { type: 'record:start'; templateId: string }
