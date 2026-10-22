import { gsap } from 'gsap'
import { afterEach, describe, expect, it } from 'vitest'
import { createVideoApi } from '../../promo/video/api'
import { TEASER_FOCUS } from '../../promo/video/camera'
import { DATASETS } from '../../promo/video/data'
import { fontsReady } from '../../promo/video/fx'
import { SCENES, sceneStart, TEASER_DURATION, TOTAL } from '../../promo/video/schedule'
import { renderStage } from '../../promo/video/stage'
import { buildTimeline } from '../../promo/video/timeline'

/** Scenes address real stage elements, so every timeline is built on the rendered stage. */
function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = renderStage()
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

  it('teaser: maps cursor targets through the zoom so the arrow lands on the scaled button', () => {
    const root = mountRoot()
    const tl = buildTimeline(root, 'teaser')
    tl.seek(1.0)
    // happy-dom measures every rect as 0/0, so the zoomed target is origin − origin·scale (minus the tip offset).
    const expectedX = TEASER_FOCUS.x - TEASER_FOCUS.x * TEASER_FOCUS.scale - 3
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=cursor]')!.style.left)).toBeCloseTo(expectedX, 0)
  })

  it('teaser: a fresh timeline shows the zoomed window, not the intro, at its very first frame', () => {
    // The render script seeks 0 first on a fresh timeline; set() tweens at 0 were skipped there.
    const root = mountRoot()
    const tl = buildTimeline(root, 'teaser')
    tl.seek(0)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=intro]')!.style.opacity)).toBe(0)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=window]')!.style.opacity)).toBe(1)
    expect(gsap.getProperty(root.querySelector('[data-el=window]')!, 'scale')).toBeCloseTo(TEASER_FOCUS.scale, 3)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=glow]')!.style.opacity)).toBeCloseTo(0.5, 3)
  })

  it('shows the real busy state while filling and clears a field before refilling it', () => {
    const root = mountRoot()
    const tl = buildTimeline(root, 'full')
    const statusText = root.querySelector('[data-el=status-text]')!
    tl.seek(sceneStart('fill') + 2.0)
    expect(statusText.textContent).toBe('Bitte warten …')
    expect(root.querySelector<HTMLElement>('[data-el=status]')!.style.display).not.toBe('none')
    tl.seek(sceneStart('fill') + 4.0)
    expect(statusText.textContent).toBe('Kundenanlage: 12 von 12 befüllt')
    // Second fill: the value is retyped from empty, never a mix of old and new characters.
    tl.seek(sceneStart('fill') + 6.55)
    const partial = root.querySelector('[data-field=company] [data-el=value]')!.textContent ?? ''
    expect(DATASETS[1].company.startsWith(partial)).toBe(true)
  })

  it('moves the cursor to the popover button where the popover actually is', () => {
    const root = mountRoot()
    const tl = buildTimeline(root, 'full')
    tl.seek(sceneStart('record') + 4.9)
    // happy-dom rects are 0/0: the popover sits at browser (-243, …), i.e. stage x −3; minus the tip offset.
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=cursor]')!.style.left)).toBeCloseTo(-6, 0)
  })

  it('teaser: shows the zoomed window without the intro and fills the form', () => {
    const root = mountRoot()
    const tl = buildTimeline(root, 'teaser')
    tl.seek(5)
    expect(gsap.getProperty(root.querySelector('[data-el=window]')!, 'scale')).toBeGreaterThanOrEqual(1.4)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=intro]')!.style.opacity)).toBe(0)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=window]')!.style.opacity)).toBe(1)
    expect(root.querySelector('[data-field=company] [data-el=value]')!.textContent).toBe(DATASETS[0].company)
    tl.seek(TEASER_DURATION - 0.1)
    expect(root.querySelector('[data-field=company] [data-el=value]')!.textContent).toBe(DATASETS[1].company)
  })
})

describe('scenes', () => {
  const mountStage = mountRoot

  it('seeks deterministically: the same time yields the same DOM regardless of the path', () => {
    const root = mountStage()
    const tl = buildTimeline(root, 'full')
    // One full pass first, so GSAP has recorded start values for every tween on both paths.
    tl.seek(TOTAL)
    tl.seek(0)
    for (const t of [4, 8.5, 20]) {
      tl.seek(t)
      const forward = root.innerHTML
      tl.seek(TOTAL - 1)
      tl.seek(t)
      expect(root.innerHTML).toBe(forward)
    }
  })

  it('shows the claim during the intro and hides it in the problem scene', () => {
    const root = mountStage()
    const tl = buildTimeline(root, 'full')
    const claim = root.querySelector<HTMLElement>('[data-el=claim]')!
    tl.seek(3)
    expect(parseFloat(claim.style.opacity)).toBeGreaterThan(0.9)
    tl.seek(sceneStart('problem') + 1)
    expect(parseFloat(claim.style.opacity)).toBe(0)
  })

  it('opens the no-app popup over a dimmed page while the app is created', () => {
    const root = mountStage()
    const tl = buildTimeline(root, 'full')
    tl.seek(sceneStart('detect') + 2.5)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=popup]')!.style.opacity)).toBe(1)
    expect(root.querySelector<HTMLElement>('[data-el=popup-noapp]')!.style.display).not.toBe('none')
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=veil]')!.style.opacity)).toBeCloseTo(0.55, 2)
    tl.seek(sceneStart('detect') + 6)
    expect(root.querySelector<HTMLElement>('[data-el=popup-app]')!.style.display).not.toBe('none')
    expect(root.querySelector<HTMLElement>('[data-el=newapp-name]')!.textContent).toBe('Kundenportal')
  })

  it('records all twelve fields with their green boxes before saving', () => {
    const root = mountStage()
    const tl = buildTimeline(root, 'full')
    tl.seek(sceneStart('record') + 5)
    expect(root.querySelector('[data-el=bar-count]')!.textContent).toBe('1 Feld')
    tl.seek(sceneStart('record') + 11.1)
    expect(root.querySelector('[data-el=bar-count]')!.textContent).toBe('12 Felder')
    for (const box of root.querySelectorAll<HTMLElement>('[data-captured]')) expect(parseFloat(box.style.opacity)).toBe(1)
    tl.seek(sceneStart('record') + 12.5)
    expect(root.querySelector<HTMLElement>('[data-el=saved]')!.style.display).not.toBe('none')
  })

  it('fills every field with the first dataset, reports success, then refills with the second', () => {
    const root = mountStage()
    const tl = buildTimeline(root, 'full')
    const value = (key: string) => root.querySelector(`[data-field=${key}] [data-el=value]`)!.textContent
    tl.seek(sceneStart('fill') + 3.8)
    expect(value('company')).toBe(DATASETS[0].company)
    expect(value('iban')).toBe(DATASETS[0].iban)
    expect(root.querySelector('[data-el=badge]')!.textContent).toBe('✓')
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=badge]')!.style.opacity)).toBe(1)
    expect(root.querySelector('[data-el=status-text]')!.textContent).toContain('12 von 12 befüllt')
    tl.seek(sceneStart('fill') + 9)
    expect(value('company')).toBe(DATASETS[1].company)
    expect(value('customerNo')).toBe(DATASETS[1].customerNo)
  })

  it('presses the three key caps and fills again without the popup', () => {
    const root = mountStage()
    const tl = buildTimeline(root, 'full')
    tl.seek(sceneStart('shortcut') + 1.5)
    expect(gsap.getProperty(root.querySelector('[data-key=alt]')!, 'y')).toBeGreaterThan(0)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=popup]')!.style.opacity)).toBe(0)
    tl.seek(sceneStart('shortcut') + 4)
    expect(root.querySelector('[data-field=company] [data-el=value]')!.textContent).toBe(DATASETS[2].company)
  })

  it('cuts to the manage page and ends on the outro with the repository address', () => {
    const root = mountStage()
    const tl = buildTimeline(root, 'full')
    tl.seek(sceneStart('manage') + 3)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=manage]')!.style.opacity)).toBe(1)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=page]')!.style.opacity)).toBe(0)
    expect(root.querySelector('[data-el=url]')!.textContent).toContain('manage.html')
    tl.seek(TOTAL - 0.1)
    const outro = root.querySelector<HTMLElement>('[data-el=outro]')!
    expect(parseFloat(outro.style.opacity)).toBe(1)
    expect(parseFloat(root.querySelector<HTMLElement>('[data-el=outro-repo]')!.style.opacity)).toBe(1)
    expect(outro.textContent).toContain('github.com/marliedev/form-filler')
  })

  it('types into the company field and wipes it again during the problem scene', () => {
    const root = mountStage()
    const tl = buildTimeline(root, 'full')
    const value = root.querySelector<HTMLElement>('[data-field=company] [data-el=value]')!
    tl.seek(sceneStart('problem') + 1.5)
    expect(value.textContent).toBe('Max')
    tl.seek(sceneStart('problem') + 4.8)
    expect(value.textContent).toBe('')
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
