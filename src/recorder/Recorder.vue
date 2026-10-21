<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, type CSSProperties } from 'vue'
import { findElement, type FormControl } from '../dom/locator'
import { DATA_TYPES } from '../generators/catalog'
import type { FieldRule } from '../model/types'
import CapturePopover from './CapturePopover.vue'
import { resolveControl, type Recorder } from './useRecorder'

defineOptions({ name: 'RecorderOverlay' })

const props = defineProps<{
  recorder: Recorder
  /** Element hosting this overlay; events from inside it are the overlay's own, not page interactions. */
  host: Element
}>()

const emit = defineEmits<{ close: [] }>()

const SAVED_NOTICE_MS = 1500
const POPOVER_WIDTH = 304
const GAP = 8
/** Keeps the popover clear of the bottom bar. */
const BAR_SPACE = 72

const doc = props.host.ownerDocument
const view = doc.defaultView ?? window
const { fields, pending } = props.recorder

const hoverEl = ref<FormControl | null>(null)
/** Bumped on scroll/resize/layout changes so the positioned boxes are re-measured. */
const tick = ref(0)
const confirming = ref(false)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const announcement = ref('')
const saveButton = ref<HTMLButtonElement | null>(null)
const keepRecordingButton = ref<HTMLButtonElement | null>(null)

/** Page element we focus ourselves after "Übernehmen"; its focusin must not reopen the popover. */
let skipFocusOf: Element | null = null

const typeLabels = new Map<string, string>(DATA_TYPES.map((d) => [d.type, d.label]))

function tagFor(field: FieldRule): string {
  const label = typeLabels.get(field.config.type) ?? field.config.type
  return field.slot === null ? label : `${label} · ${field.slot}`
}

function rectStyle(rect: DOMRect, inset = 3): CSSProperties {
  return {
    top: `${rect.top - inset}px`,
    left: `${rect.left - inset}px`,
    width: `${rect.width + inset * 2}px`,
    height: `${rect.height + inset * 2}px`,
  }
}

function measure(el: Element): DOMRect | null {
  const rect = el.getBoundingClientRect()
  return rect.width === 0 && rect.height === 0 ? null : rect
}

const boxes = computed(() => {
  void tick.value
  if (saved.value) return []
  return fields.value.flatMap((field) => {
    const found = findElement(doc, field.locator)
    if (found.status !== 'found') return []
    const rect = measure(found.el)
    return rect ? [{ id: field.id, style: rectStyle(rect), tag: tagFor(field) }] : []
  })
})

const hoverStyle = computed(() => {
  void tick.value
  const rect = hoverEl.value && !saved.value ? measure(hoverEl.value) : null
  return rect ? rectStyle(rect) : null
})

const pendingStyle = computed(() => {
  void tick.value
  const rect = pending.value ? measure(pending.value.el) : null
  return rect ? rectStyle(rect) : null
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

const popoverStyle = computed<CSSProperties>(() => {
  void tick.value
  const el = pending.value?.el
  if (!el) return {}
  const rect = el.getBoundingClientRect()
  const vw = view.innerWidth
  const vh = view.innerHeight
  const left = clamp(rect.left, GAP, vw - POPOVER_WIDTH - GAP)
  const spaceBelow = vh - BAR_SPACE - rect.bottom
  if (spaceBelow >= 320 || spaceBelow >= rect.top) {
    const top = clamp(rect.bottom + GAP, GAP, vh - BAR_SPACE - 160)
    return { top: `${top}px`, left: `${left}px`, maxHeight: `${vh - BAR_SPACE - top}px` }
  }
  const bottom = clamp(vh - rect.top + GAP, BAR_SPACE, vh - 160)
  return { bottom: `${bottom}px`, left: `${left}px`, maxHeight: `${vh - bottom - GAP}px` }
})

const count = computed(() => fields.value.length)

function announce(text: string): void {
  announcement.value = text
}

function focusBar(): void {
  void nextTick(() => saveButton.value?.focus())
}

function close(): void {
  emit('close')
}

function requestEnd(): void {
  if (!props.recorder.dirty.value) {
    close()
    return
  }
  confirming.value = true
  void nextTick(() => keepRecordingButton.value?.focus())
}

function keepRecording(): void {
  confirming.value = false
  focusBar()
}

function discard(): void {
  props.recorder.cancel()
  close()
}

function handleEscape(): void {
  if (saved.value) return
  if (confirming.value) keepRecording()
  else if (pending.value) {
    props.recorder.dismiss()
    focusBar()
  } else requestEnd()
}

function returnFocusToPage(el: FormControl): void {
  // focusin fires synchronously inside focus(), so the skip only covers this one call.
  skipFocusOf = el
  el.focus({ preventScroll: true })
  skipFocusOf = null
  // Not focusable (e.g. an ARIA group host): keep keyboard users in the overlay instead.
  if (doc.activeElement !== el) focusBar()
}

function onAccept(rule: FieldRule): void {
  const el = pending.value?.el
  props.recorder.accept(rule)
  announce(`Feld „${rule.label}“ übernommen · ${count.value} ${count.value === 1 ? 'Feld' : 'Felder'}`)
  if (el) returnFocusToPage(el)
  else focusBar()
}

function onCancel(): void {
  props.recorder.dismiss()
  focusBar()
}

function onRemove(fieldId: string): void {
  props.recorder.remove(fieldId)
  props.recorder.dismiss()
  announce(`Feld entfernt · ${count.value} ${count.value === 1 ? 'Feld' : 'Felder'}`)
  focusBar()
}

async function onSave(): Promise<void> {
  if (saving.value || saved.value) return
  saving.value = true
  error.value = ''
  try {
    await props.recorder.save()
    props.recorder.dismiss()
    confirming.value = false
    saved.value = true
    announce('Vorlage gespeichert')
    view.setTimeout(close, SAVED_NOTICE_MS)
  } catch (e) {
    error.value = `Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    saving.value = false
  }
}

function fromOverlay(event: Event): boolean {
  return event.composedPath().includes(props.host)
}

function onPageFocusIn(event: FocusEvent): void {
  if (fromOverlay(event)) return
  // composedPath()[0] is the real target even inside a page's own shadow DOM.
  const target = event.composedPath()[0]
  if (!(target instanceof Element)) return
  if (target === skipFocusOf) return
  if (confirming.value || saved.value) return
  if (pending.value) {
    // An open draft is never replaced implicitly; the user finishes it first.
    if (resolveControl(target)) announce('Bitte das offene Feld zuerst übernehmen oder abbrechen.')
    return
  }
  // A throw inside a page event listener would vanish in the console; show it in the overlay.
  try {
    if (props.recorder.capture(target)) error.value = ''
  } catch (e) {
    error.value = `Feld konnte nicht erfasst werden: ${e instanceof Error ? e.message : String(e)}`
  }
}

function onPageMouseOver(event: MouseEvent): void {
  if (fromOverlay(event)) {
    hoverEl.value = null
    return
  }
  const target = event.composedPath()[0]
  hoverEl.value = target instanceof Element ? resolveControl(target) : null
}

function onPageKeydown(event: KeyboardEvent): void {
  // Keys inside the overlay are handled by its own listener.
  if (event.key !== 'Escape' || fromOverlay(event)) return
  event.preventDefault()
  event.stopPropagation()
  handleEscape()
}

function onOverlayKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  handleEscape()
}

let frame = 0
function scheduleMeasure(): void {
  if (frame) return
  frame = view.requestAnimationFrame(() => {
    frame = 0
    tick.value++
  })
}

let interval = 0
onMounted(() => {
  doc.addEventListener('focusin', onPageFocusIn, true)
  doc.addEventListener('mouseover', onPageMouseOver, true)
  doc.addEventListener('keydown', onPageKeydown, true)
  view.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true })
  view.addEventListener('resize', scheduleMeasure, { passive: true })
  // Pages show and hide fields without scroll/resize (e.g. conditional sections).
  interval = view.setInterval(scheduleMeasure, 1000)
  focusBar()
})

onUnmounted(() => {
  doc.removeEventListener('focusin', onPageFocusIn, true)
  doc.removeEventListener('mouseover', onPageMouseOver, true)
  doc.removeEventListener('keydown', onPageKeydown, true)
  view.removeEventListener('scroll', scheduleMeasure, { capture: true })
  view.removeEventListener('resize', scheduleMeasure)
  view.clearInterval(interval)
  if (frame) view.cancelAnimationFrame(frame)
})

defineExpose({ focusBar })
</script>

<template>
  <div
    class="font-sans text-sm text-zinc-900"
    @keydown="onOverlayKeydown"
  >
    <div
      v-for="box in boxes"
      :key="box.id"
      aria-hidden="true"
      data-testid="captured-box"
      class="pointer-events-none fixed z-[2147483645] rounded-md border-2 border-green-600"
      :style="box.style"
    >
      <span class="absolute -top-5 right-0 rounded-sm bg-green-700 px-1.5 text-xs leading-5 whitespace-nowrap text-white">
        {{ box.tag }}
      </span>
    </div>

    <div
      v-if="hoverStyle"
      aria-hidden="true"
      class="pointer-events-none fixed z-[2147483645] rounded-md border-2 border-dashed border-blue-600"
      :style="hoverStyle"
    />

    <div
      v-if="pendingStyle"
      aria-hidden="true"
      class="pointer-events-none fixed z-[2147483645] rounded-md border-2 border-blue-600"
      :style="pendingStyle"
    />

    <div
      v-if="pending"
      class="fixed z-[2147483647] overflow-auto rounded-xl"
      :style="popoverStyle"
    >
      <CapturePopover
        :pending="pending"
        :fields="fields"
        @accept="onAccept"
        @cancel="onCancel"
        @remove="onRemove"
      />
    </div>

    <!-- Stacked so a save error and the discard question never overlap. -->
    <div
      v-if="confirming || error"
      class="pointer-events-none fixed bottom-20 left-1/2 z-[2147483647] flex w-80 max-w-[calc(100vw-16px)] -translate-x-1/2 flex-col gap-2"
    >
      <p
        v-if="error"
        role="alert"
        class="pointer-events-auto rounded-md bg-red-700 px-3 py-2 text-white"
      >
        {{ error }}
      </p>
      <div
        v-if="confirming"
        role="alertdialog"
        aria-labelledby="ff-confirm-title"
        aria-describedby="ff-confirm-text"
        class="pointer-events-auto rounded-xl border border-zinc-300 bg-white p-4 shadow-xl"
      >
        <h2
          id="ff-confirm-title"
          class="font-semibold"
        >
          Ungespeicherte Änderungen verwerfen?
        </h2>
        <p
          id="ff-confirm-text"
          class="mt-1 text-zinc-700"
        >
          Die Aufnahme wird ohne Speichern beendet.
        </p>
        <div class="mt-3 flex justify-end gap-2">
          <button
            ref="keepRecordingButton"
            type="button"
            class="rounded-md border border-zinc-500 px-3 py-1.5 font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
            @click="keepRecording"
          >
            Weiter aufnehmen
          </button>
          <button
            type="button"
            class="rounded-md bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            @click="discard"
          >
            Verwerfen
          </button>
        </div>
      </div>
    </div>

    <div
      role="region"
      aria-label="Aufnahme"
      class="fixed bottom-4 left-1/2 z-[2147483647] flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-3xl bg-zinc-900 py-1.5 pr-1.5 pl-4 text-white shadow-lg"
    >
      <template v-if="saved">
        <span class="py-1.5 pr-2.5">✓ Vorlage gespeichert</span>
      </template>
      <template v-else>
        <span>
          <span
            aria-hidden="true"
            class="text-red-400"
          >●</span>
          Aufnahme · {{ count }} {{ count === 1 ? 'Feld' : 'Felder' }} · Esc beendet
        </span>
        <span class="flex gap-1">
          <button
            type="button"
            class="rounded-full px-3 py-1.5 font-medium hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400"
            @click="requestEnd"
          >
            Beenden
          </button>
          <button
            ref="saveButton"
            type="button"
            :aria-disabled="saving || undefined"
            class="rounded-full bg-white px-3 py-1.5 font-semibold text-zinc-900 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            @click="onSave"
          >
            {{ saving ? 'Speichert …' : 'Speichern' }}
          </button>
        </span>
      </template>
    </div>


    <div
      role="status"
      aria-live="polite"
      class="sr-only"
    >
      {{ announcement }}
    </div>
  </div>
</template>
