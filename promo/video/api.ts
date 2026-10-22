import type { gsap } from 'gsap'
import type { Mode, VideoApi } from './video-api'

/** The object the render script drives through `window.__video`. */
export function createVideoApi(tl: gsap.core.Timeline, mode: Mode, ready: Promise<void>): VideoApi {
  return {
    ready,
    mode,
    duration: tl.duration(),
    // Must return nothing: GSAP's seek() returns the timeline, which Playwright could never serialize.
    seek: (t) => { tl.seek(t, false) },
  }
}
