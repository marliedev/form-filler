import type { gsap } from 'gsap'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const tenths = Math.floor((seconds * 10) % 10)
  return `${m}:${String(s).padStart(2, '0')}.${tenths}`
}

/** Play/pause, a scrubber over the whole timeline and a time readout, below the stage. */
export function mountPreview(tl: gsap.core.Timeline, host: HTMLElement): void {
  const duration = tl.duration()
  const otherMode = new URLSearchParams(location.search).get('mode') === 'teaser' ? 'full' : 'teaser'
  host.className = 'flex items-center gap-4 px-6 py-4 text-sm text-muted'
  host.innerHTML = `
    <button type="button" data-el="play" class="rounded-sm bg-brand px-3 py-1.5 font-medium text-on-brand">Play</button>
    <input type="range" data-el="scrub" min="0" max="${duration}" step="${1 / 30}" value="0" class="w-[600px] accent-brand-fg">
    <span data-el="time" class="font-display tabular-nums text-text">${formatTime(0)} / ${formatTime(duration)}</span>
    <a href="?mode=${otherMode}" class="text-brand-fg underline underline-offset-3">Modus: ${otherMode}</a>
  `
  const play = host.querySelector<HTMLButtonElement>('[data-el=play]')!
  const scrub = host.querySelector<HTMLInputElement>('[data-el=scrub]')!
  const time = host.querySelector<HTMLSpanElement>('[data-el=time]')!

  const sync = (): void => {
    scrub.value = String(tl.time())
    time.textContent = `${formatTime(tl.time())} / ${formatTime(duration)}`
    play.textContent = tl.isActive() ? 'Pause' : 'Play'
  }
  tl.eventCallback('onUpdate', sync)
  tl.eventCallback('onComplete', sync)
  play.addEventListener('click', () => {
    if (tl.isActive()) tl.pause()
    else if (tl.progress() >= 1) tl.restart()
    else tl.play()
    sync()
  })
  scrub.addEventListener('input', () => {
    tl.pause()
    tl.seek(Number(scrub.value), false)
    sync()
  })
  sync()
}
