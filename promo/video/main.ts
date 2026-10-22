import './styles.css'
import { registerPageFonts } from '../../src/theme/overlayFonts'
import { fontsReady } from './fx'
import { mountPreview } from './preview'
import { renderStage } from './stage'
import { buildTimeline } from './timeline'
import type { Mode, VideoApi } from './video-api'

const params = new URLSearchParams(location.search)
const mode: Mode = params.get('mode') === 'teaser' ? 'teaser' : 'full'
// `?render` is what the render script opens: no controls, the stage alone at 0/0.
const render = params.has('render')

registerPageFonts()

const stage = document.getElementById('stage')!
stage.innerHTML = renderStage()
const tl = buildTimeline(stage, mode)

const api: VideoApi = {
  ready: fontsReady(document),
  mode,
  duration: tl.duration(),
  seek: (t) => tl.seek(t, false),
}
window.__video = api

if (!render) {
  mountPreview(tl, document.getElementById('controls')!)
  if (params.has('play')) void api.ready.then(() => tl.play())
}
