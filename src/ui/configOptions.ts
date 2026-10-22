import { slotKindFor } from '../generators/catalog'
import type { ControlKind, DataTypeConfig, FieldRule } from '../model/types'
import { clone, slotChoices } from '../recorder/useRecorder'

const WITH_OPTIONS: ReadonlySet<DataTypeConfig['type']> = new Set([
  'fixed', 'choice', 'list', 'pattern', 'date', 'number', 'birthDate', 'checkbox',
])

/** Whether `ConfigEditor` shows any inputs for the type. */
export function hasOptions(type: DataTypeConfig['type']): boolean {
  return WITH_OPTIONS.has(type)
}

const NON_TEXT_KINDS: ReadonlySet<ControlKind> = new Set(['select', 'radiogroup', 'checkbox', 'combobox'])
/** Types resolving to a date, choice, checkbox state or nothing, never to text. */
const NON_TEXT_TYPES: ReadonlySet<DataTypeConfig['type']> = new Set([
  'salutation', 'birthDate', 'date', 'choice', 'checkbox', 'empty',
])

/** Whether "Kennung anhängen" can have an effect: the run id is only appended to text values. */
export function runIdApplies(kind: ControlKind, config: DataTypeConfig): boolean {
  return !NON_TEXT_KINDS.has(kind) && !NON_TEXT_TYPES.has(config.type)
}

export const RUN_ID_NOT_APPLICABLE = 'Nur bei Textwerten möglich – hier ohne Wirkung.'

export interface SlotOption {
  value: string
  label: string
}

/**
 * Slot choices for a field of `config`'s type: slots in use by the other fields, the current slot
 * (even if unusual) and the next free one as "neu". Empty for types without a slot.
 */
export function slotOptions(
  fields: readonly FieldRule[],
  config: DataTypeConfig,
  currentSlot: string | null,
  selfId: string,
): SlotOption[] {
  const kind = slotKindFor(config)
  if (kind === null) return []
  // The edited field itself must not count as "in use" under its old slot.
  const others = fields.filter((f) => f.id !== selfId)
  const { existing, next } = slotChoices(others, kind)
  const prefix = kind === 'person' ? 'Person' : 'Adresse'
  const options = existing.map((slot) => ({ value: slot, label: `${prefix} ${slot}` }))
  if (currentSlot !== null && !existing.includes(currentSlot) && currentSlot !== next) {
    options.push({ value: currentSlot, label: `${prefix} ${currentSlot}` })
  }
  options.push({ value: next, label: `${prefix} ${next} (neu)` })
  return options
}

/** A copy without inputs the chosen options hide (from/to only apply to the 'between' range). */
export function finalizeConfig(config: DataTypeConfig): DataTypeConfig {
  const copy = clone(config)
  if (copy.type === 'date' && copy.range !== 'between') {
    delete copy.from
    delete copy.to
  }
  return copy
}
