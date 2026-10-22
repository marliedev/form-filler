/* Render CLI: `npm run video:render [-- --mode teaser --fps 20 --at 1.5,9 --skip-encode --reduce fps15]`.
   Serves the stage with Vite, drives the installed Chrome through Playwright, writes one PNG per
   frame and lets ffmpeg encode the MP4 (full) or the palette + GIF (teaser). */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { ffmpegArgs, fontReport, frameTimes, hasEncoders, nextReduction, parseArgs, sizeLimit, type RenderArgs } from './render-lib'
import type { VideoApi } from './video-api'

const OUT = 'promo/video/out'
const GIF = 'docs/media/teaser.gif'
const STAGE = { x: 0, y: 0, width: 1920, height: 1080 }

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function ffmpeg(args: string[]): void {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' })
  if (result.status !== 0) fail(`ffmpeg ist fehlgeschlagen (${args.join(' ')})`)
}

function checkFfmpeg(): void {
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' })
  if (probe.error || probe.status !== 0) fail('ffmpeg wurde nicht gefunden. Installieren: brew install ffmpeg')
  if (!hasEncoders(probe.stdout)) fail('Dieses ffmpeg kann kein H.264 oder GIF. Vollständiges ffmpeg installieren: brew install ffmpeg')
}

function checkSize(file: string, kind: 'mp4' | 'gif', args: RenderArgs): void {
  const bytes = statSync(file).size
  const mb = (bytes / 1024 / 1024).toFixed(2)
  if (bytes <= sizeLimit(kind)) {
    console.log(`${file}: ${mb} MB`)
    return
  }
  const step = nextReduction(args.reduce)
  const hint = step ? `Nächster Schritt: --reduce ${[...args.reduce, step].join(' --reduce ')}` : 'Keine Reduktionsstufe mehr übrig.'
  fail(`${file} ist mit ${mb} MB zu groß (Limit ${sizeLimit(kind) / 1024 / 1024} MB). ${hint}`)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const encode = !args.skipEncode && args.at === null
  if (encode) checkFfmpeg()

  const fps = args.reduce.includes('fps15') ? 15 : args.fps
  const dither = !args.reduce.includes('nodither')

  const server = await createServer({ configFile: 'promo/video/vite.config.ts', logLevel: 'error' })
  await server.listen()
  const url = server.resolvedUrls?.local[0]
  if (!url) fail('Vite hat keine URL geliefert')
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: STAGE.width, height: STAGE.height }, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => fail(`Fehler auf der Seite: ${e.message}`))
    await page.goto(`${url}?render&mode=${args.mode}`)
    // Interval polling: the default rAF polling can stall in a page that is never painted.
    await page.waitForFunction(() => window.__video !== undefined, undefined, { polling: 100, timeout: 30_000 })
    await page.evaluate(() => (window.__video as VideoApi).ready)
    for (const line of fontReport(await page.evaluate(() => ({
      Wotfard: document.fonts.check('300 16px Wotfard'),
      'Bricolage Grotesque': document.fonts.check('700 16px "Bricolage Grotesque"'),
    })))) console.warn(line)

    let duration = await page.evaluate(() => (window.__video as VideoApi).duration)
    if (args.reduce.includes('trim9s')) duration = Math.min(duration, 9)

    const seek = (t: number): Promise<void> => page.evaluate((time) => { (window.__video as VideoApi).seek(time) }, t)

    if (args.at !== null) {
      const dir = join(OUT, 'at')
      mkdirSync(dir, { recursive: true })
      for (const t of args.at) {
        await seek(t)
        const file = join(dir, `${args.mode}-${t}.png`)
        await page.screenshot({ path: file, clip: STAGE })
        console.log(file)
      }
      return
    }

    const dir = join(OUT, args.mode === 'full' ? 'frames' : 'teaser')
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const times = frameTimes(duration, fps)
    console.log(`${args.mode}: ${times.length} Bilder bei ${fps} fps (${duration} s)`)
    for (const [i, t] of times.entries()) {
      await seek(t)
      await page.screenshot({ path: join(dir, `${String(i).padStart(5, '0')}.png`), clip: STAGE })
      if (i % 100 === 0) process.stdout.write(`\r${i}/${times.length}`)
    }
    process.stdout.write(`\r${times.length}/${times.length}\n`)
    if (!encode) return

    const input = join(dir, '%05d.png')
    if (args.mode === 'full') {
      const output = join(OUT, 'form-filler.mp4')
      ffmpeg(ffmpegArgs('mp4', { fps, input, output, dither }))
      checkSize(output, 'mp4', args)
    } else {
      const palette = join(OUT, 'palette.png')
      mkdirSync('docs/media', { recursive: true })
      ffmpeg(ffmpegArgs('palette', { fps, input, output: palette, dither }))
      ffmpeg(ffmpegArgs('gif', { fps, input, output: GIF, palette, dither }))
      checkSize(GIF, 'gif', args)
    }
  } finally {
    await browser.close()
    await server.close()
  }
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
