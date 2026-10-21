import { createApp, type App } from 'vue'
import { ContentScriptContext } from 'wxt/utils/content-script-context'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import type { RecordStartResponse } from '../fill/messages'
import { getTemplate } from '../storage/repository'
import Recorder from './Recorder.vue'
import css from './recorder.css?inline'
import { useRecorder, type Recorder as RecorderState } from './useRecorder'

interface ActiveRecording {
  templateId: string
  recorder: RecorderState
  ctx: ContentScriptContext
  focus(): void
}

let active: ActiveRecording | null = null
/** Serializes starts so two quick `record:start` messages cannot mount two overlays. */
let queue: Promise<unknown> = Promise.resolve()

function stop(recording: ActiveRecording): void {
  if (active === recording) active = null
  // Invalidating the context removes the shadow root UI (and unmounts the app via onRemove).
  recording.ctx.abort('Recording ended')
}

async function mount(templateId: string): Promise<RecordStartResponse> {
  const template = await getTemplate(templateId)
  if (!template) return { ok: false, error: 'Vorlage nicht gefunden' }

  if (active) {
    if (active.templateId === templateId) {
      active.focus()
      return { ok: true }
    }
    if (active.recorder.dirty.value) {
      return { ok: false, error: 'Auf der Seite läuft noch eine Aufnahme mit ungespeicherten Änderungen. Bitte zuerst speichern oder beenden.' }
    }
    stop(active)
  }

  // Own context instead of the one passed to main(): every later injection of the content
  // script (e.g. a fill) creates a new main context and invalidates the previous one.
  const ctx = new ContentScriptContext('form-filler-recorder', { noScriptStartedPostMessage: true })
  const recorder = useRecorder(template)
  let exposed: { focusBar(): void } | null = null
  const recording: ActiveRecording = { templateId, recorder, ctx, focus: () => exposed?.focusBar() }

  const ui = await createShadowRootUi<App>(ctx, {
    name: 'form-filler-recorder',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    css,
    // Typing in the popover must not trigger the page's own keyboard shortcuts.
    isolateEvents: true,
    onMount(container, _shadow, host) {
      const app = createApp(Recorder, {
        recorder,
        host,
        // Deferred so the app is not unmounted from inside its own event handler.
        onClose: () => queueMicrotask(() => stop(recording)),
      })
      exposed = app.mount(container) as unknown as { focusBar(): void }
      return app
    },
    onRemove(app) {
      app?.unmount()
    },
  })
  ui.mount()
  active = recording
  return { ok: true }
}

/** Starts (or refocuses) the recorder overlay; resolves as soon as it is mounted. */
export function startRecorder(templateId: string): Promise<RecordStartResponse> {
  const run = queue.then(() => mount(templateId))
  queue = run.catch(() => undefined)
  return run.catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }))
}
