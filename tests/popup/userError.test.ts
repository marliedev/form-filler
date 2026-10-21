import { describe, expect, it } from 'vitest'
import { toUserError } from '../../src/popup/userError'

const RESTRICTED = 'Auf dieser Seite können keine Formulare befüllt werden.'
const NO_PERMISSION = 'Keine Berechtigung für diese Seite – App-Adresse prüfen.'

describe('toUserError', () => {
  it.each([
    'Cannot access a chrome:// URL',
    'Cannot access a chrome-extension:// URL of different extension',
    'The extensions gallery cannot be scripted.',
    'Cannot access contents of url "edge://settings". Extension manifest must request permission to access this host.',
    'Frame with ID 0 is showing error page',
  ])('maps restricted pages: %s', (raw) => {
    expect(toUserError(new Error(raw))).toEqual({ message: RESTRICTED })
  })

  it.each([
    'Cannot access contents of url "https://app.example.com/". Extension manifest must request permission to access this host.',
    'Cannot access contents of the page. Extension manifest must request permission to access the respective host.',
    'Missing host permission for the tab',
  ])('maps missing host permissions: %s', (raw) => {
    expect(toUserError(new Error(raw))).toEqual({ message: NO_PERMISSION })
  })

  it.each([
    'Die Seite hat nicht geantwortet',
    'Could not establish connection. Receiving end does not exist.',
    'The message port closed before a response was received.',
  ])('maps a missing answer: %s', (raw) => {
    expect(toUserError(new Error(raw)).message).toMatch(/^Die Seite hat nicht geantwortet/)
  })

  it('keeps known German errors from the extension', () => {
    expect(toUserError(new Error('Vorlage nicht gefunden'))).toEqual({ message: 'Vorlage nicht gefunden.' })
  })

  it('maps a closed tab', () => {
    expect(toUserError(new Error('No tab with id: 12.')).message).toBe('Der Tab ist nicht mehr geöffnet.')
  })

  it('falls back to a generic German message with the raw text as detail', () => {
    expect(toUserError(new Error('Something odd'), 'Befüllen fehlgeschlagen.')).toEqual({
      message: 'Befüllen fehlgeschlagen.',
      detail: 'Something odd',
    })
  })

  it('accepts non-Error values', () => {
    expect(toUserError('boom')).toEqual({ message: 'Das hat nicht geklappt.', detail: 'boom' })
  })
})
