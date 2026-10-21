<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { slotKindFor } from '../generators/catalog'
import type { DataTypeConfig, FieldRule } from '../model/types'
import {
  clone,
  configFor,
  parseLines,
  slotChoices,
  slotFor,
  typeGroups,
  validateConfig,
  type ConfigError,
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
/** Raw textarea content; parsed on accept so blank lines can be typed without being swallowed. */
const valuesText = ref('')
const error = ref<ConfigError | null>(null)
const typeSelect = ref<HTMLSelectElement | null>(null)
const root = ref<HTMLElement | null>(null)

function valuesOf(config: DataTypeConfig): string {
  return config.type === 'list' || config.type === 'choice' ? config.values.join('\n') : ''
}

watch(
  () => props.pending,
  (pending) => {
    draft.value = clone(pending.rule)
    valuesText.value = valuesOf(pending.rule.config)
    error.value = null
    void nextTick(() => typeSelect.value?.focus())
  },
  { immediate: true },
)

const groups = computed(() => typeGroups(draft.value.locator.kind, draft.value.config.type))
const slotKind = computed(() => slotKindFor(draft.value.config))
const slots = computed(() => {
  const kind = slotKind.value
  if (kind === null) return []
  // The edited field itself must not count as "in use" under its old slot.
  const others = props.fields.filter((f) => f.id !== draft.value.id)
  const { existing, next } = slotChoices(others, kind)
  const prefix = kind === 'person' ? 'Person' : 'Adresse'
  const options = existing.map((slot) => ({ value: slot, label: `${prefix} ${slot}` }))
  if (draft.value.slot !== null && !existing.includes(draft.value.slot) && draft.value.slot !== next) {
    options.push({ value: draft.value.slot, label: `${prefix} ${draft.value.slot}` })
  }
  options.push({ value: next, label: `${prefix} ${next} (neu)` })
  return options
})

const type = computed({
  get: () => draft.value.config.type,
  set: (value: DataTypeConfig['type']) => {
    const candidates = props.pending.isNew ? [props.pending.suggestion] : [props.pending.rule.config, props.pending.suggestion]
    const config = configFor(value, candidates)
    draft.value.config = config
    draft.value.slot = slotFor(config, props.fields.filter((f) => f.id !== draft.value.id), draft.value.slot)
    valuesText.value = valuesOf(config)
    error.value = null
  },
})

const checkboxState = computed({
  get: () => (draft.value.config.type === 'checkbox' ? String(draft.value.config.checked) : 'true'),
  set: (value: string) => {
    if (draft.value.config.type !== 'checkbox') return
    draft.value.config.checked = value === 'random' ? 'random' : value === 'true'
  },
})

const requiredDetected = computed(() => props.pending.isNew && props.pending.rule.required)

function finalConfig(): DataTypeConfig {
  const config = clone(draft.value.config)
  if (config.type === 'list' || config.type === 'choice') config.values = parseLines(valuesText.value)
  if (config.type === 'date' && config.range !== 'between') {
    delete config.from
    delete config.to
  }
  return config
}

function accept(): void {
  const config = finalConfig()
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

function invalid(input: ConfigError['input']): boolean {
  return error.value?.input === input
}

const inputClass =
  'mt-1 block w-full rounded-md border border-zinc-500 bg-white px-2 py-1.5 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 aria-invalid:border-red-700'
const labelClass = 'block text-xs font-medium text-zinc-700'
</script>

<template>
  <div
    ref="root"
    role="dialog"
    aria-labelledby="ff-pop-title"
    class="w-76 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 shadow-xl"
    @keydown="trapTab"
  >
    <form
      class="space-y-3"
      novalidate
      @submit.prevent="accept"
    >
      <div>
        <h2
          id="ff-pop-title"
          class="text-sm font-semibold break-words"
        >
          Feld „{{ draft.label }}“
        </h2>
        <p
          v-if="!pending.isNew"
          class="text-xs text-zinc-600"
        >
          Bereits erfasst – Änderungen ersetzen das Feld.
        </p>
      </div>

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

      <!-- Options of the chosen data type -->
      <div v-if="draft.config.type === 'fixed'">
        <label
          for="ff-fixed"
          :class="labelClass"
        >Wert</label>
        <input
          id="ff-fixed"
          v-model="draft.config.value"
          type="text"
          :class="inputClass"
        >
      </div>

      <template v-else-if="draft.config.type === 'choice'">
        <div>
          <label
            for="ff-mode"
            :class="labelClass"
          >Auswahl</label>
          <select
            id="ff-mode"
            v-model="draft.config.mode"
            :class="inputClass"
          >
            <option value="random">
              Zufällig eine Option
            </option>
            <option value="subset">
              Zufällig mehrere Optionen
            </option>
            <option value="fixed">
              Feste Werte
            </option>
          </select>
        </div>
        <div>
          <label
            for="ff-values"
            :class="labelClass"
          >Werte (einer pro Zeile)</label>
          <textarea
            id="ff-values"
            v-model="valuesText"
            data-input="values"
            rows="3"
            aria-describedby="ff-values-hint"
            :aria-invalid="invalid('values') || undefined"
            :class="inputClass"
          />
          <p
            id="ff-values-hint"
            class="mt-1 text-xs text-zinc-600"
          >
            Leer lassen = aus allen Optionen des Felds wählen.
          </p>
        </div>
      </template>

      <div v-else-if="draft.config.type === 'list'">
        <label
          for="ff-list"
          :class="labelClass"
        >Werte (einer pro Zeile)</label>
        <textarea
          id="ff-list"
          v-model="valuesText"
          data-input="values"
          rows="3"
          :aria-invalid="invalid('values') || undefined"
          :class="inputClass"
        />
      </div>

      <div v-else-if="draft.config.type === 'pattern'">
        <label
          for="ff-pattern"
          :class="labelClass"
        >Muster</label>
        <input
          id="ff-pattern"
          v-model="draft.config.pattern"
          data-input="pattern"
          type="text"
          aria-describedby="ff-pattern-hint"
          :aria-invalid="invalid('pattern') || undefined"
          :class="inputClass"
        >
        <p
          id="ff-pattern-hint"
          class="mt-1 text-xs text-zinc-600"
        >
          Platzhalter: {zahl:6}, {buchstabe:2}, {kennung}, {datum}
        </p>
      </div>

      <template v-else-if="draft.config.type === 'date'">
        <div>
          <label
            for="ff-range"
            :class="labelClass"
          >Zeitraum</label>
          <select
            id="ff-range"
            v-model="draft.config.range"
            :class="inputClass"
          >
            <option value="past">
              In der Vergangenheit
            </option>
            <option value="future">
              In der Zukunft
            </option>
            <option value="between">
              Zwischen zwei Daten
            </option>
          </select>
        </div>
        <div
          v-if="draft.config.range === 'between'"
          class="grid grid-cols-2 gap-2"
        >
          <div>
            <label
              for="ff-from"
              :class="labelClass"
            >Von</label>
            <input
              id="ff-from"
              v-model="draft.config.from"
              data-input="from"
              type="date"
              :aria-invalid="invalid('from') || undefined"
              :class="inputClass"
            >
          </div>
          <div>
            <label
              for="ff-to"
              :class="labelClass"
            >Bis</label>
            <input
              id="ff-to"
              v-model="draft.config.to"
              data-input="to"
              type="date"
              :aria-invalid="invalid('to') || undefined"
              :class="inputClass"
            >
          </div>
        </div>
      </template>

      <div
        v-else-if="draft.config.type === 'number'"
        class="grid grid-cols-2 gap-2"
      >
        <div>
          <label
            for="ff-min"
            :class="labelClass"
          >Minimum</label>
          <input
            id="ff-min"
            v-model.number="draft.config.min"
            data-input="min"
            type="number"
            :aria-invalid="invalid('min') || undefined"
            :class="inputClass"
          >
        </div>
        <div>
          <label
            for="ff-max"
            :class="labelClass"
          >Maximum</label>
          <input
            id="ff-max"
            v-model.number="draft.config.max"
            data-input="max"
            type="number"
            :aria-invalid="invalid('max') || undefined"
            :class="inputClass"
          >
        </div>
      </div>

      <div v-else-if="draft.config.type === 'birthDate'">
        <label
          for="ff-age"
          :class="labelClass"
        >Mindestalter (Jahre)</label>
        <input
          id="ff-age"
          v-model.number="draft.config.minAge"
          data-input="minAge"
          type="number"
          min="0"
          max="120"
          :aria-invalid="invalid('minAge') || undefined"
          :class="inputClass"
        >
      </div>

      <div v-else-if="draft.config.type === 'checkbox'">
        <label
          for="ff-checked"
          :class="labelClass"
        >Zustand</label>
        <select
          id="ff-checked"
          v-model="checkboxState"
          :class="inputClass"
        >
          <option value="true">
            Angehakt
          </option>
          <option value="false">
            Nicht angehakt
          </option>
          <option value="random">
            Zufällig
          </option>
        </select>
      </div>

      <fieldset class="space-y-1.5">
        <legend class="sr-only">
          Eigenschaften
        </legend>
        <label class="flex items-center gap-2">
          <input
            v-model="draft.required"
            type="checkbox"
            class="size-4 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
          <span>Pflichtfeld <span
            v-if="requiredDetected"
            class="text-xs text-zinc-600"
          >(auf der Seite erkannt)</span></span>
        </label>
        <label class="flex items-center gap-2">
          <input
            v-model="draft.appendRunId"
            type="checkbox"
            aria-describedby="ff-runid-hint"
            class="size-4 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
          <span>Kennung anhängen</span>
        </label>
        <p
          id="ff-runid-hint"
          class="pl-6 text-xs text-zinc-600"
        >
          Hängt die Kennung des Testlaufs an den Wert an.
        </p>
      </fieldset>

      <p
        v-if="error"
        role="alert"
        class="text-xs font-medium text-red-700"
      >
        {{ error.message }}
      </p>

      <div class="flex items-center gap-2 pt-1">
        <button
          v-if="!pending.isNew"
          type="button"
          class="mr-auto rounded-md px-2 py-1.5 font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          @click="emit('remove', draft.id)"
        >
          Entfernen
        </button>
        <button
          type="button"
          class="ml-auto rounded-md border border-zinc-500 px-3 py-1.5 font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          @click="emit('cancel')"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Übernehmen
        </button>
      </div>
    </form>
  </div>
</template>
