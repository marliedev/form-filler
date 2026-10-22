import { describe, expect, it } from 'vitest'
import { POPOVER_MIN_HEIGHT, popoverPlacement } from '../../src/recorder/placement'

const px = (value: unknown): number => Number.parseFloat(String(value))

describe('popoverPlacement', () => {
  it('opens below the field when there is enough room', () => {
    const style = popoverPlacement({ top: 100, bottom: 132, left: 40 }, 1200, 900)
    expect(style).toMatchObject({ top: '140px', left: '40px' })
    expect(px(style.maxHeight)).toBeGreaterThanOrEqual(POPOVER_MIN_HEIGHT)
  })

  it('opens above a field near the bottom', () => {
    const style = popoverPlacement({ top: 700, bottom: 732, left: 40 }, 1200, 900)
    expect(style.top).toBeUndefined()
    expect(style.bottom).toBe('208px')
    expect(px(style.maxHeight)).toBeGreaterThanOrEqual(POPOVER_MIN_HEIGHT)
  })

  it('never gets shorter than the minimum height, even if it then covers the field', () => {
    // 500px viewport, field in the middle: neither side offers the minimum height.
    const style = popoverPlacement({ top: 220, bottom: 252, left: 40 }, 1200, 500)
    expect(px(style.maxHeight)).toBeGreaterThanOrEqual(POPOVER_MIN_HEIGHT)
  })

  it('uses the whole usable height when the viewport is smaller than the minimum', () => {
    const style = popoverPlacement({ top: 100, bottom: 132, left: 40 }, 1200, 300)
    expect(style).toMatchObject({ top: '8px', maxHeight: '220px' })
  })

  it('keeps the popover inside a narrow viewport', () => {
    expect(popoverPlacement({ top: 100, bottom: 132, left: 280 }, 320, 900).left).toBe('8px')
  })
})
