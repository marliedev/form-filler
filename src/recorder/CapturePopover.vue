<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { slotKindFor } from '../generators/catalog'
import ConfigEditor from '../ui/ConfigEditor.vue'
import { finalizeConfig, RUN_ID_NOT_APPLICABLE, runIdApplies, slotOptions } from '../ui/configOptions'
import type { DataTypeConfig, FieldRule } from '../model/types'
import { validateConfig, type ConfigError } from '../model/validateConfig'
import {
  clone,
  configFor,
  slotFor,
  typeGroups,
  type PendingCapture,
} from './useRecorder'

defineOptions({ name: 'CapturePopover' })

const props = defineProps<{
  pending: PendingCapture
  fields: FieldRule[]
}>()

const emit = defineEmits<{
  accept: [rule: FieldRule]
  cancel: []
  remove: [fieldId: string]
}>()

const draft = ref<FieldRule>(clone(props.pending.rule))
const error = ref<ConfigError | null>(null)
const typeSelect = ref<HTMLSelectElement | null>(null)
const root = ref<HTMLElement | null>(null)

watch(
  () => props.pending,
  (pending) => {
    draft.value = clone(pending.rule)
    error.value = null
    void nextTick(() => typeSelect.value?.focus())
  },
  { immediate: true },
)

const groups = computed(() => typeGroups(draft.value.locator.kind, draft.value.config.type))
const slotKind = computed(() => slotKindFor(draft.value.config))
const slots = computed(() => slotOptions(props.fields, draft.value.config, draft.value.slot, draft.value.id))

const type = computed({
  get: () => draft.value.config.type,
  set: (value: DataTypeConfig['type']) => {
    const candidates = props.pending.isNew ? [props.pending.suggestion] : [props.pending.rule.config, props.pending.suggestion]
    const config = configFor(value, candidates)
    draft.value.config = config
    draft.value.slot = slotFor(config, props.fields.filter((f) => f.id !== draft.value.id), draft.value.slot)
    error.value = null
  },
})

const runIdEnabled = computed(() => runIdApplies(draft.value.locator.kind, draft.value.config))

const requiredDetected = computed(() => props.pending.isNew && props.pending.rule.required)

function accept(): void {
  const config = finalizeConfig(draft.value.config)
  const problem = validateConfig(config)
  error.value = problem
  if (problem) {
    void nextTick(() => root.value?.querySelector<HTMLElement>(`[data-input="${problem.input}"]`)?.focus())
    return
  }
  emit('accept', { ...clone(draft.value), config })
}

const FOCUSABLE = 'select, input, textarea, button'

/** Keeps Tab inside the open popover so focus cannot drift to the page and lose the draft. */
function trapTab(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return
  const items = Array.from(root.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
    (el) => !(el as HTMLInputElement).disabled,
  )
  const first = items[0]
  const last = items.at(-1)
  if (!first || !last) return
  // Inside the overlay's shadow root the document only sees the host as active element.
  const active = (root.value?.getRootNode() as Document | ShadowRoot | undefined)?.activeElement ?? null
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  } else if (!items.some((el) => el === active)) {
    event.preventDefault()
    first.focus()
  }
}

const inputClass =
  'mt-1 block w-full rounded-sm border border-muted bg-surface px-2 py-1.5 text-sm text-text focus-visible:focus-ring aria-invalid:border-error'
const labelClass = 'block text-xs font-medium text-muted'
const chipClass =
  'inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 has-checked:border-brand-fg has-checked:text-brand-fg'
</script>

<template>
  <div
    ref="root"
    role="dialog"
    aria-labelledby="ff-pop-title"
    class="flex min-h-0 w-76 flex-col rounded-2xl border border-border-subtle bg-bg text-sm text-text shadow-xl"
    @keydown="trapTab"
  >
    <!-- Header and buttons stay put; only the middle scrolls when the viewport is short. -->
    <form
      class="flex min-h-0 flex-1 flex-col"
      novalidate
      @submit.prevent="accept"
    >
      <div class="border-b border-border-subtle px-3.5 pt-3 pb-2.5">
        <h2
          id="ff-pop-title"
          class="font-display text-base font-semibold break-words"
        >
          Feld „{{ draft.label }}“
        </h2>
        <p
          v-if="!pending.isNew"
          class="text-xs text-muted"
        >
          Bereits erfasst – Änderungen ersetzen das Feld.
        </p>
        <p
          v-if="pending.unlocatable"
          role="alert"
          class="mt-1.5 flex items-start gap-2 rounded-xl bg-surface px-2.5 py-1.5 text-xs"
        >
          <span
            aria-hidden="true"
            class="mt-1 size-2 shrink-0 rounded-full bg-warning"
          />
          Dieses Feld hat keine eindeutigen Merkmale und wird beim Füllen voraussichtlich nicht wiedergefunden.
        </p>
      </div>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
        <div>
          <label
            for="ff-type"
            :class="labelClass"
          >Datentyp</label>
          <select
            id="ff-type"
            ref="typeSelect"
            v-model="type"
            :class="inputClass"
          >
            <optgroup
              v-for="group in groups"
              :key="group.group"
              :label="group.group"
            >
              <option
                v-for="meta in group.types"
                :key="meta.type"
                :value="meta.type"
              >
                {{ meta.label }}
              </option>
            </optgroup>
          </select>
        </div>

        <div v-if="slotKind !== null">
          <label
            for="ff-slot"
            :class="labelClass"
          >{{ slotKind === 'person' ? 'Gehört zu Person' : 'Gehört zu Adresse' }}</label>
          <select
            id="ff-slot"
            v-model="draft.slot"
            :class="inputClass"
          >
            <option
              v-for="slot in slots"
              :key="slot.value"
              :value="slot.value"
            >
              {{ slot.label }}
            </option>
          </select>
        </div>

        <ConfigEditor
          v-model="draft.config"
          :error="error"
        />

        <fieldset class="space-y-1.5">
          <legend class="sr-only">
            Eigenschaften
          </legend>
          <div class="flex flex-wrap gap-1.5">
            <label :class="chipClass">
              <input
                v-model="draft.required"
                type="checkbox"
                class="size-3.5 accent-brand-fg focus-visible:focus-ring"
              >
              <span>Pflichtfeld</span>
            </label>
            <label
              :class="[chipClass, { 'cursor-not-allowed text-muted': !runIdEnabled }]"
            >
              <input
                v-model="draft.appendRunId"
                type="checkbox"
                :disabled="!runIdEnabled"
                aria-describedby="ff-runid-hint"
                class="size-3.5 accent-brand-fg focus-visible:focus-ring disabled:cursor-not-allowed"
              >
              <span>Kennung anhängen</span>
            </label>
          </div>
          <p
            v-if="requiredDetected"
            class="text-xs text-muted"
          >
            Pflichtfeld auf der Seite erkannt.
          </p>
          <p
            id="ff-runid-hint"
            class="text-xs text-muted"
          >
            {{ runIdEnabled ? 'Hängt die Kennung des Testlaufs an den Wert an.' : RUN_ID_NOT_APPLICABLE }}
          </p>
        </fieldset>

        <p
          v-if="error"
          role="alert"
          class="text-xs font-medium text-error"
        >
          {{ error.message }}
        </p>
      </div>

      <div class="flex items-center gap-2 border-t border-border-subtle px-3.5 py-2.5">
        <button
          v-if="!pending.isNew"
          type="button"
          class="mr-auto rounded-sm px-2 py-1.5 font-medium text-error hover:underline hover:underline-offset-3 focus-visible:focus-ring"
          @click="emit('remove', draft.id)"
        >
          Entfernen
        </button>
        <button
          type="button"
          class="ml-auto rounded-sm border border-line px-3 py-1.5 font-medium text-text hover:bg-surface focus-visible:focus-ring"
          @click="emit('cancel')"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="rounded-sm bg-brand px-3 py-1.5 font-medium text-on-brand hover:brightness-125 focus-visible:focus-ring"
        >
          Übernehmen
        </button>
      </div>
    </form>
  </div>
</template>
