import { describe, expect, it } from 'vitest'
import { buildExport } from '../../src/model/schema'
import type { AppDef, Template } from '../../src/model/types'
import { fetchSource, SourceError } from '../../src/sync/fetchSource'

const app: AppDef = { id: 'a', name: 'App', urlPatterns: ['https://app.example.com/*'] }
const tpl: Template = { id: 't', appId: 'a', name: 'Kunde', process: null, fields: [], lastMissing: [] }
const NOT_EXPORT = 'Die Adresse liefert keine Form-Filler-Export-Datei. Bei Freigabe-Links die direkte Download-Adresse eintragen.'
const UNREACHABLE = 'Quelle nicht erreichbar.'

/** A fetch stand-in answering with `body`; only the members fetchSource reads are provided. */
function responding(body: string, init: { status?: number; headers?: Record<string, string> } = {}): typeof fetch {
  const status = init.status ?? 200
  const response = { ok: status >= 200 && status < 300, status, headers: new Headers(init.headers), text: async () => body }
  return async () => response as unknown as Response
}

describe('fetchSource', () => {
  it('returns the parsed export file, following redirects with a timeout', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const impl: typeof fetch = async (input, init) => {
      calls.push([String(input), init])
      return responding(buildExport([app], [tpl]))(input, init)
    }
    const file = await fetchSource('https://team.example.com/templates.json', impl)
    expect(file.apps).toEqual([app])
    expect(file.templates).toEqual([tpl])
    expect(calls[0]?.[0]).toBe('https://team.example.com/templates.json')
    expect(calls[0]?.[1]).toMatchObject({ redirect: 'follow' })
    expect(calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('explains an HTML answer (share page, login) with the download hint', async () => {
    const html = responding('<!doctype html><html><body>Anmelden</body></html>', { headers: { 'content-type': 'text/html' } })
    await expect(fetchSource('https://team.example.com/share/abc', html)).rejects.toThrow(new SourceError(NOT_EXPORT))
    await expect(fetchSource('https://team.example.com/share/abc', html)).rejects.toBeInstanceOf(SourceError)
  })

  it('rejects JSON that is not an export file and text that is not JSON', async () => {
    await expect(fetchSource('https://x.example.com/f', responding('{"hello":1}'))).rejects.toThrow(new SourceError(NOT_EXPORT))
    await expect(fetchSource('https://x.example.com/f', responding('{broken'))).rejects.toThrow(new SourceError(NOT_EXPORT))
  })

  it('refuses an answer over 5 MB without reading it', async () => {
    const big = responding('{}', { headers: { 'content-length': String(6 * 1024 * 1024) } })
    await expect(fetchSource('https://x.example.com/f', big)).rejects.toThrow(new SourceError('Die Datei der Quelle ist größer als 5 MB.'))
  })

  it('reports network failures and error statuses as unreachable', async () => {
    const failing: typeof fetch = async () => { throw new TypeError('Failed to fetch') }
    await expect(fetchSource('https://x.example.com/f', failing)).rejects.toThrow(new SourceError(UNREACHABLE))
    await expect(fetchSource('https://x.example.com/f', responding('nope', { status: 404 }))).rejects.toThrow(new SourceError(UNREACHABLE))
  })

  it('allows only http and https addresses', async () => {
    const message = 'Nur http- und https-Adressen sind erlaubt.'
    await expect(fetchSource('file:///tmp/templates.json', responding('{}'))).rejects.toThrow(new SourceError(message))
    await expect(fetchSource('keine adresse', responding('{}'))).rejects.toThrow(new SourceError(message))
  })
})
