export type Mode = 'full' | 'teaser'

/** What the render script drives: wait for `ready`, then `seek` frame by frame. */
export interface VideoApi {
  ready: Promise<void>
  mode: Mode
  duration: number
  seek(t: number): void
}

declare global {
  interface Window {
    __video?: VideoApi
  }
}
