import type { Mode } from './video-api'

/* Pure helpers of the render CLI, kept free of I/O so they can be unit-tested. */

export const REDUCTIONS = ['fps15', 'trim9s', 'nodither'] as const
export type Reduction = (typeof REDUCTIONS)[number]

export interface RenderArgs {
  mode: Mode
  fps: number
  /** Single frame times to capture instead of the whole timeline. */
  at: number[] | null
  skipEncode: boolean
  reduce: Reduction[]
}

const DEFAULT_FPS: Record<Mode, number> = { full: 30, teaser: 20 }

export function parseArgs(argv: string[]): RenderArgs {
  const args: RenderArgs = { mode: 'full', fps: 0, at: null, skipEncode: false, reduce: [] }
  let fps: number | null = null
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--mode' && (value === 'full' || value === 'teaser')) { args.mode = value; i++ }
    else if (flag === '--fps' && value !== undefined) { fps = Number(value); i++ }
    else if (flag === '--at' && value !== undefined) { args.at = value.split(',').map(Number); i++ }
    else if (flag === '--skip-encode') args.skipEncode = true
    else if (flag === '--reduce' && value !== undefined) {
      if (!(REDUCTIONS as readonly string[]).includes(value)) throw new Error(`Unbekannter Reduktionsschritt: ${value}`)
      args.reduce.push(value as Reduction)
      i++
    } else throw new Error(`Unbekanntes Argument: ${flag}`)
  }
  args.fps = fps ?? DEFAULT_FPS[args.mode]
  return args
}

export function frameTimes(duration: number, fps: number): number[] {
  const count = Math.ceil(duration * fps)
  return Array.from({ length: count }, (_, i) => i / fps)
}

export interface EncodeOptions {
  fps: number
  input: string
  output: string
  palette?: string
  dither: boolean
}

const SCALE = 'scale=960:540:flags=lanczos'

export function ffmpegArgs(kind: 'mp4' | 'palette' | 'gif', o: EncodeOptions): string[] {
  const fps = String(o.fps)
  switch (kind) {
    case 'mp4':
      return ['-y', '-framerate', fps, '-i', o.input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', o.output]
    case 'palette':
      return ['-y', '-framerate', fps, '-i', o.input, '-vf', `${SCALE},palettegen=max_colors=256:stats_mode=diff`, o.output]
    case 'gif': {
      const dither = o.dither ? 'dither=bayer:bayer_scale=3' : 'dither=none'
      return ['-y', '-framerate', fps, '-i', o.input, '-i', o.palette ?? '', '-lavfi', `${SCALE}[x];[x][1:v]paletteuse=${dither}`, '-loop', '0', o.output]
    }
  }
}

/** The ffmpeg bundled with Playwright only has VP8; MP4 and GIF need a full build. */
export function hasEncoders(encoderList: string): boolean {
  return /\blibx264\b/.test(encoderList) && /^\s*V\S*\s+gif\s/m.test(encoderList)
}

export function sizeLimit(kind: 'mp4' | 'gif'): number {
  return (kind === 'mp4' ? 10 : 5) * 1024 * 1024
}

export function nextReduction(done: readonly string[]): Reduction | null {
  return REDUCTIONS.find((step) => !done.includes(step)) ?? null
}

/** `document.fonts.check()` answers true for unknown families, so loaded faces are inspected instead. */
export function fontLoaded(faces: readonly { family: string; status: string }[], family: string): boolean {
  return faces.some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded')
}

export function fontReport(checks: Record<string, boolean>): string[] {
  return Object.entries(checks).filter(([, loaded]) => !loaded).map(([name]) => `Schrift nicht geladen: ${name}`)
}
