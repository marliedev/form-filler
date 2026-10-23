import { describe, expect, it } from 'vitest'
import { buildExport } from '../../src/model/schema'
import type { AppDef, Template } from '../../src/model/types'
import { fetchSource, SourceError } from '../../src/sync/fetchSource'

const app: AppDef = { id: 'a', name: 'App', urlPatterns: ['https://app.example.com/*'] }
const tpl: Template = { id: 't', appId: 'a', name: 'Kunde', process: null, fields: [], lastMissing: [] }
const NOT_EXPORT = 'Die Adresse liefert keine Form-Filler-Export-Datei. Bei Freigabe-Links die direkte Download-Adresse eintragen.'
const UNREACHABLE = 'Quelle nicht erreichbar.'

/** A fetch stand-in answering with `body`; only the members fetchSource reads are provided. */
function responding(body: string, init: { status?: number; headers?: Record<string, string>; redirectedTo?: string } = {}): typeof fetch {
  const status = init.status ?? 200
  return async (input) => {
    const url = init.redirectedTo ?? String(input)
    const response = { ok: status >= 200 && status < 300, status, headers: new Headers(init.headers), redirected: init.redirectedTo !== undefined, url, text: async () => body }
    return response as unknown as Response
  }
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

  it('reports error statuses as unreachable, and a blocked fetch with the download hint', async () => {
    await expect(fetchSource('https://x.example.com/f', responding('nope', { status: 404 }))).rejects.toThrow(new SourceError(UNREACHABLE))
    // The browser blocks a fetch for DNS failures, missing host permissions and redirects to hosts it may not reach alike.
    const failing: typeof fetch = async () => { throw new TypeError('Failed to fetch') }
    await expect(fetchSource('https://x.example.com/f', failing)).rejects.toThrow(
      new SourceError('Quelle nicht erreichbar. Bei Freigabe-Links die direkte Download-Adresse eintragen.'),
    )
  })

  it('fails a redirect to another host with the download hint naming that host, follows one on the same host', async () => {
    const body = buildExport([app], [tpl])
    const elsewhere = responding(body, { redirectedTo: 'https://login.example.org/share/abc' })
    await expect(fetchSource('https://team.example.com/share/abc', elsewhere)).rejects.toThrow(
      new SourceError('Die Adresse leitet auf login.example.org weiter. Bitte die direkte Download-Adresse eintragen.'),
    )
    const sameHost = responding(body, { redirectedTo: 'https://team.example.com/files/templates.json?dl=1' })
    expect((await fetchSource('http://team.example.com/share/abc', sameHost)).templates).toEqual([tpl])
  })

  it('allows only http and https addresses', async () => {
    const message = 'Nur http- und https-Adressen sind erlaubt.'
    await expect(fetchSource('file:///tmp/templates.json', responding('{}'))).rejects.toThrow(new SourceError(message))
    await expect(fetchSource('keine adresse', responding('{}'))).rejects.toThrow(new SourceError(message))
  })
})
