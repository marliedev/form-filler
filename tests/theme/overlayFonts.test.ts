import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OVERLAY_FONT_BODY,
  OVERLAY_FONT_DISPLAY,
  localBodyFaces,
  registerOverlayFonts,
  registerPageFonts,
} from '../../src/theme/overlayFonts'

// Tiny data URL standing in for a woff2 file; the fake FontFace never parses it.
const FAKE = 'data:font/woff2;base64,AAAA'
const BODY = [
  { source: FAKE, weight: '300' },
  { source: FAKE, weight: '500' },
]

class FakeFontFace {
  loaded = Promise.resolve(this)
  constructor(
    public family: string,
    public source: ArrayBuffer,
    public descriptors: FontFaceDescriptors,
  ) {}
}

describe('registerOverlayFonts', () => {
  const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.__formFillerFonts
    if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
    else delete (document as { fonts?: unknown }).fonts
  })

  function setup(): FakeFontFace[] {
    const added: FakeFontFace[] = []
    vi.stubGlobal('FontFace', FakeFontFace)
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: (f: FakeFontFace) => added.push(f) } })
    return added
  }

  it('registers the prefixed faces from binary data on the page document', () => {
    const added = setup()
    registerOverlayFonts(document, BODY)
    expect(added.map((f) => [f.family, f.descriptors.weight])).toEqual([
      [OVERLAY_FONT_BODY, '300'],
      [OVERLAY_FONT_BODY, '500'],
      [OVERLAY_FONT_DISPLAY, '600 800'],
    ])
    expect(added.every((f) => f.source instanceof ArrayBuffer && f.source.byteLength > 0)).toBe(true)
  })

  it('registers only once per page', () => {
    const added = setup()
    registerOverlayFonts(document, BODY)
    registerOverlayFonts(document, BODY)
    expect(added).toHaveLength(3)
  })

  it('does nothing without the FontFace API', () => {
    vi.stubGlobal('FontFace', undefined)
    expect(() => registerOverlayFonts(document)).not.toThrow()
    expect(window.__formFillerFonts).toBeUndefined()
  })

  it('registers only the display face when no local body font exists', () => {
    const added = setup()
    registerOverlayFonts(document, [])
    expect(added.map((f) => f.family)).toEqual([OVERLAY_FONT_DISPLAY])
  })
})

describe('localBodyFaces', () => {
  it('maps the known local files to their weights and skips missing ones', () => {
    expect(localBodyFaces({ './fonts/local/wotfard-medium.woff2': FAKE })).toEqual([{ source: FAKE, weight: '500' }])
    expect(localBodyFaces({})).toEqual([])
  })
})

describe('registerPageFonts', () => {
  const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
    else delete (document as { fonts?: unknown }).fonts
  })

  it('registers the local body faces under the page family name', () => {
    const added: FakeFontFace[] = []
    vi.stubGlobal('FontFace', FakeFontFace)
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: (f: FakeFontFace) => added.push(f) } })
    registerPageFonts(document, BODY)
    expect(added.map((f) => [f.family, f.descriptors.weight])).toEqual([
      ['Wotfard', '300'],
      ['Wotfard', '500'],
    ])
  })
})
