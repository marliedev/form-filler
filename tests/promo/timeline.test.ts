import { afterEach, describe, expect, it } from 'vitest'
import { createVideoApi } from '../../promo/video/api'
import { fontsReady } from '../../promo/video/fx'
import { SCENES, sceneStart, TEASER_DURATION, TOTAL } from '../../promo/video/schedule'
import { buildTimeline } from '../../promo/video/timeline'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.append(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('buildTimeline', () => {
  it('builds a paused full timeline with one label per scene', () => {
    const tl = buildTimeline(mountRoot(), 'full')
    expect(tl.paused()).toBe(true)
    expect(tl.labels).toEqual(Object.fromEntries(SCENES.map((s) => [s.id, sceneStart(s.id)])))
    expect(tl.duration()).toBeCloseTo(TOTAL, 3)
  })

  it('builds the teaser timeline with the teaser duration', () => {
    expect(buildTimeline(mountRoot(), 'teaser').duration()).toBeCloseTo(TEASER_DURATION, 3)
  })
})

describe('createVideoApi', () => {
  it('exposes mode and duration and makes seek return nothing', () => {
    // GSAP's seek() returns the timeline; handing that to Playwright's evaluate would never serialize.
    const tl = buildTimeline(mountRoot(), 'full')
    const api = createVideoApi(tl, 'full', Promise.resolve())
    expect(api.mode).toBe('full')
    expect(api.duration).toBeCloseTo(TOTAL, 3)
    expect(api.seek(1)).toBeUndefined()
    expect(tl.time()).toBe(1)
  })
})

describe('fontsReady', () => {
  const original = Object.getOwnPropertyDescriptor(document, 'fonts')

  afterEach(() => {
    if (original) Object.defineProperty(document, 'fonts', original)
    else delete (document as { fonts?: unknown }).fonts
  })

  it('requests the video fonts and resolves after document.fonts.ready', async () => {
    const loaded: string[] = []
    let resolved = false
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        load: (spec: string) => { loaded.push(spec); return Promise.resolve([]) },
        ready: Promise.resolve().then(() => { resolved = true }),
      },
    })
    await fontsReady(document)
    expect(resolved).toBe(true)
    expect(loaded.some((s) => s.includes('Bricolage Grotesque'))).toBe(true)
    expect(loaded.some((s) => s.includes('Wotfard'))).toBe(true)
  })

  it('resolves without a FontFaceSet', async () => {
    delete (document as { fonts?: unknown }).fonts
    await expect(fontsReady(document)).resolves.toBeUndefined()
  })
})
