import type { DataTypeConfig } from './types'

export interface ConfigError {
  message: string
  /** Which option input the message refers to, so the UI can mark and focus it. */
  input: 'value' | 'values' | 'pattern' | 'min' | 'max' | 'from' | 'to' | 'minAge'
}

/** Rejects options the generators cannot sensibly produce a value from. */
export function validateConfig(config: DataTypeConfig): ConfigError | null {
  switch (config.type) {
    case 'fixed':
      // An intentionally empty field is what the "Leer lassen" type is for.
      return config.value.trim() === ''
        ? { message: 'Bitte einen Wert eingeben. Für ein leeres Feld den Typ „Leer lassen“ wählen.', input: 'value' }
        : null
    case 'list':
      return config.values.length === 0 ? { message: 'Bitte mindestens einen Wert eingeben (ein Wert pro Zeile).', input: 'values' } : null
    case 'choice':
      return config.mode === 'fixed' && config.values.length === 0
        ? { message: 'Für „Fest“ bitte mindestens einen Wert eingeben.', input: 'values' }
        : null
    case 'pattern':
      return config.pattern.trim() === '' ? { message: 'Bitte ein Muster eingeben, z. B. TEST-{zahl:6}.', input: 'pattern' } : null
    case 'number':
      if (!Number.isFinite(config.min)) return { message: 'Bitte ein Minimum als Zahl angeben.', input: 'min' }
      if (!Number.isFinite(config.max)) return { message: 'Bitte ein Maximum als Zahl angeben.', input: 'max' }
      return config.min > config.max ? { message: 'Das Minimum darf nicht größer als das Maximum sein.', input: 'min' } : null
    case 'birthDate':
      return Number.isInteger(config.minAge) && config.minAge >= 0 && config.minAge <= 120
        ? null
        : { message: 'Bitte ein Mindestalter zwischen 0 und 120 angeben.', input: 'minAge' }
    case 'date':
      if (config.range !== 'between') return null
      if (!config.from) return { message: 'Bitte ein Startdatum angeben.', input: 'from' }
      if (!config.to) return { message: 'Bitte ein Enddatum angeben.', input: 'to' }
      return config.from > config.to ? { message: 'Das Startdatum muss vor dem Enddatum liegen.', input: 'from' } : null
    default:
      return null
  }
}
