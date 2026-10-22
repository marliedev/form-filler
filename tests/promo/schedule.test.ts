import { describe, expect, it } from 'vitest'
import { SCENES, sceneStart, TEASER_DURATION, TOTAL } from '../../promo/video/schedule'

describe('scene schedule', () => {
  it('orders the scenes as in the spec and lands between 50 and 60 seconds', () => {
    expect(SCENES.map((s) => s.id)).toEqual(['intro', 'problem', 'detect', 'record', 'fill', 'shortcut', 'manage', 'outro'])
    expect(sceneStart('fill')).toBe(33)
    expect(TOTAL).toBeGreaterThanOrEqual(50)
    expect(TOTAL).toBeLessThanOrEqual(60)
  })

  it('keeps the teaser between 10 and 12 seconds', () => {
    expect(TEASER_DURATION).toBeGreaterThanOrEqual(10)
    expect(TEASER_DURATION).toBeLessThanOrEqual(12)
  })
})
