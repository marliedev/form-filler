import { afterEach, describe, expect, it, vi } from 'vitest'
import { OVERLAY_FONT_BODY, OVERLAY_FONT_DISPLAY, registerOverlayFonts } from '../../src/theme/overlayFonts'

class FakeFontFace {
  loaded = Promise.resolve(this)
  constructor(
    public family: string,
    public source: ArrayBuffer,
    public descriptors: FontFaceDescriptors,
  ) {}
}

describe('registerOverlayFonts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.__formFillerFonts
  })

  function setup(): FakeFontFace[] {
    const added: FakeFontFace[] = []
    vi.stubGlobal('FontFace', FakeFontFace)
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: (f: FakeFontFace) => added.push(f) } })
    return added
  }

  it('registers the prefixed faces from binary data on the page document', () => {
    const added = setup()
    registerOverlayFonts(document)
    expect(added.map((f) => [f.family, f.descriptors.weight])).toEqual([
      [OVERLAY_FONT_BODY, '300'],
      [OVERLAY_FONT_BODY, '500'],
      [OVERLAY_FONT_DISPLAY, '600 800'],
    ])
    expect(added.every((f) => f.source instanceof ArrayBuffer && f.source.byteLength > 0)).toBe(true)
  })

  it('registers only once per page', () => {
    const added = setup()
    registerOverlayFonts(document)
    registerOverlayFonts(document)
    expect(added).toHaveLength(3)
  })

  it('does nothing without the FontFace API', () => {
    vi.stubGlobal('FontFace', undefined)
    expect(() => registerOverlayFonts(document)).not.toThrow()
    expect(window.__formFillerFonts).toBeUndefined()
  })
})
