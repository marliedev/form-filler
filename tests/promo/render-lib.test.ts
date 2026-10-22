import { describe, expect, it } from 'vitest'
import {
  ffmpegArgs, fontLoaded, fontReport, frameTimes, hasEncoders, nextReduction, parseArgs, REDUCTIONS, sizeLimit,
} from '../../promo/video/render-lib'

describe('parseArgs', () => {
  it('defaults to the full video at 30 fps with encoding', () => {
    expect(parseArgs([])).toEqual({ mode: 'full', fps: 30, at: null, skipEncode: false, reduce: [] })
  })

  it('switches the teaser to 20 fps unless fps is given', () => {
    expect(parseArgs(['--mode', 'teaser']).fps).toBe(20)
    expect(parseArgs(['--mode', 'teaser', '--fps', '15']).fps).toBe(15)
  })

  it('parses single frame times, skip-encode and reduction steps', () => {
    const args = parseArgs(['--at', '1.5,9', '--skip-encode', '--reduce', 'fps15', '--reduce', 'trim9s'])
    expect(args.at).toEqual([1.5, 9])
    expect(args.skipEncode).toBe(true)
    expect(args.reduce).toEqual(['fps15', 'trim9s'])
  })
})

describe('frameTimes', () => {
  it('lists one time per frame from zero up to, not including, the duration', () => {
    const times = frameTimes(2, 30)
    expect(times).toHaveLength(60)
    expect(times[0]).toBe(0)
    expect(times[59]).toBeCloseTo(59 / 30, 9)
  })
})

describe('ffmpegArgs', () => {
  it('encodes the mp4 as H.264 yuv420p at the given fps', () => {
    const args = ffmpegArgs('mp4', { fps: 30, input: 'out/frames/%05d.png', output: 'out/form-filler.mp4', dither: true })
    expect(args).toEqual(expect.arrayContaining(['-framerate', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart']))
    expect(args.at(-1)).toBe('out/form-filler.mp4')
  })

  it('builds the two gif passes with a 960x540 palette and bayer dithering', () => {
    const palette = ffmpegArgs('palette', { fps: 20, input: 'out/teaser/%05d.png', output: 'out/palette.png', dither: true })
    expect(palette.join(' ')).toContain('scale=960:540:flags=lanczos,palettegen=max_colors=256:stats_mode=diff')
    const gif = ffmpegArgs('gif', { fps: 20, input: 'out/teaser/%05d.png', output: 'docs/media/teaser.gif', palette: 'out/palette.png', dither: true })
    expect(gif.join(' ')).toContain('paletteuse=dither=bayer:bayer_scale=3')
    expect(gif).toEqual(expect.arrayContaining(['-loop', '0']))
    const flat = ffmpegArgs('gif', { fps: 20, input: 'i', output: 'o', palette: 'p', dither: false })
    expect(flat.join(' ')).toContain('paletteuse=dither=none')
  })
})

describe('encoder and size checks', () => {
  it('requires both libx264 and gif encoders', () => {
    const withBoth = ' V....D libx264              libx264 H.264\n V....D gif                  GIF (Graphics Interchange Format)\n'
    const vp8Only = ' V....D libvpx               libvpx VP8 (codec vp8)\n'
    expect(hasEncoders(withBoth)).toBe(true)
    expect(hasEncoders(vp8Only)).toBe(false)
  })

  it('limits the mp4 to 10 MiB and the gif to 5 MiB', () => {
    expect(sizeLimit('mp4')).toBe(10 * 1024 * 1024)
    expect(sizeLimit('gif')).toBe(5 * 1024 * 1024)
  })

  it('walks the reduction steps in the fixed order', () => {
    expect(REDUCTIONS).toEqual(['fps15', 'trim9s', 'nodither'])
    expect(nextReduction([])).toBe('fps15')
    expect(nextReduction(['fps15'])).toBe('trim9s')
    expect(nextReduction(['fps15', 'trim9s', 'nodither'])).toBeNull()
  })
})

describe('fontLoaded', () => {
  it('only counts a face of that family whose status is loaded', () => {
    const faces = [
      { family: '"Bricolage Grotesque"', status: 'loaded' },
      { family: 'Wotfard', status: 'unloaded' },
    ]
    expect(fontLoaded(faces, 'Bricolage Grotesque')).toBe(true)
    expect(fontLoaded(faces, 'Wotfard')).toBe(false)
    expect(fontLoaded([], 'Wotfard')).toBe(false)
  })
})

describe('fontReport', () => {
  it('names every font that did not load', () => {
    expect(fontReport({ Wotfard: false, 'Bricolage Grotesque': true })).toEqual(['Schrift nicht geladen: Wotfard'])
    expect(fontReport({ Wotfard: true, 'Bricolage Grotesque': true })).toEqual([])
  })
})
