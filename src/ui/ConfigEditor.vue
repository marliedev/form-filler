<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DataTypeConfig } from '../model/types'
import type { ConfigError } from '../model/validateConfig'
import { clone, parseLines } from '../recorder/useRecorder'

defineOptions({ name: 'ConfigEditor' })

const props = withDefaults(
  defineProps<{
    error?: ConfigError | null
    /** Prefix for element ids; must be unique per page when several editors are open. */
    idPrefix?: string
  }>(),
  { error: null, idPrefix: 'ff' },
)

/** Emits a new config object on every change; list values arrive parsed (one per line, blanks dropped). */
const model = defineModel<DataTypeConfig>({ required: true })

const draft = ref<DataTypeConfig>(clone(model.value))
/** Raw textarea content so blank lines can be typed without being swallowed by the parsing. */
const valuesText = ref(valuesOf(model.value))

function valuesOf(config: DataTypeConfig): string {
  return config.type === 'list' || config.type === 'choice' ? config.values.join('\n') : ''
}

const output = computed<DataTypeConfig>(() => {
  const config = clone(draft.value)
  if (config.type === 'list' || config.type === 'choice') config.values = parseLines(valuesText.value)
  return config
})

const same = (a: DataTypeConfig, b: DataTypeConfig): boolean => JSON.stringify(a) === JSON.stringify(b)

watch(output, (config) => {
  if (!same(config, model.value)) model.value = config
})

// Only an outside change (e.g. a new type picked) resets the inputs; our own echo must not.
watch(
  model,
  (config) => {
    if (same(config, output.value)) return
    draft.value = clone(config)
    valuesText.value = valuesOf(config)
  },
  { deep: true },
)

const checkboxState = computed({
  get: () => (draft.value.type === 'checkbox' ? String(draft.value.checked) : 'true'),
  set: (value: string) => {
    if (draft.value.type !== 'checkbox') return
    draft.value.checked = value === 'random' ? 'random' : value === 'true'
  },
})

function invalid(input: ConfigError['input']): boolean {
  return props.error?.input === input
}

const id = (name: string): string => `${props.idPrefix}-${name}`

const inputClass =
  'mt-1 block w-full rounded-md border border-zinc-500 bg-white px-2 py-1.5 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 aria-invalid:border-red-700'
const labelClass = 'block text-xs font-medium text-zinc-700'
</script>

<template>
  <div v-if="draft.type === 'fixed'">
    <label
      :for="id('fixed')"
      :class="labelClass"
    >Wert</label>
    <input
      :id="id('fixed')"
      v-model="draft.value"
      data-input="value"
      type="text"
      :aria-invalid="invalid('value') || undefined"
      :class="inputClass"
    >
  </div>

  <div
    v-else-if="draft.type === 'choice'"
    class="space-y-3"
  >
    <div>
      <label
        :for="id('mode')"
        :class="labelClass"
      >Auswahl</label>
      <select
        :id="id('mode')"
        v-model="draft.mode"
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
        :for="id('values')"
        :class="labelClass"
      >Werte (einer pro Zeile)</label>
      <textarea
        :id="id('values')"
        v-model="valuesText"
        data-input="values"
        rows="3"
        :aria-describedby="id('values-hint')"
        :aria-invalid="invalid('values') || undefined"
        :class="inputClass"
      />
      <p
        :id="id('values-hint')"
        class="mt-1 text-xs text-zinc-600"
      >
        Leer lassen = aus allen Optionen des Felds wählen.
      </p>
    </div>
  </div>

  <div v-else-if="draft.type === 'list'">
    <label
      :for="id('list')"
      :class="labelClass"
    >Werte (einer pro Zeile)</label>
    <textarea
      :id="id('list')"
      v-model="valuesText"
      data-input="values"
      rows="3"
      :aria-invalid="invalid('values') || undefined"
      :class="inputClass"
    />
  </div>

  <div v-else-if="draft.type === 'pattern'">
    <label
      :for="id('pattern')"
      :class="labelClass"
    >Muster</label>
    <input
      :id="id('pattern')"
      v-model="draft.pattern"
      data-input="pattern"
      type="text"
      :aria-describedby="id('pattern-hint')"
      :aria-invalid="invalid('pattern') || undefined"
      :class="inputClass"
    >
    <p
      :id="id('pattern-hint')"
      class="mt-1 text-xs text-zinc-600"
    >
      Platzhalter: {zahl:6}, {buchstabe:2}, {kennung}, {datum}
    </p>
  </div>

  <div
    v-else-if="draft.type === 'date'"
    class="space-y-3"
  >
    <div>
      <label
        :for="id('range')"
        :class="labelClass"
      >Zeitraum</label>
      <select
        :id="id('range')"
        v-model="draft.range"
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
      v-if="draft.range === 'between'"
      class="grid grid-cols-2 gap-2"
    >
      <div>
        <label
          :for="id('from')"
          :class="labelClass"
        >Von</label>
        <input
          :id="id('from')"
          v-model="draft.from"
          data-input="from"
          type="date"
          :aria-invalid="invalid('from') || undefined"
          :class="inputClass"
        >
      </div>
      <div>
        <label
          :for="id('to')"
          :class="labelClass"
        >Bis</label>
        <input
          :id="id('to')"
          v-model="draft.to"
          data-input="to"
          type="date"
          :aria-invalid="invalid('to') || undefined"
          :class="inputClass"
        >
      </div>
    </div>
  </div>

  <div
    v-else-if="draft.type === 'number'"
    class="grid grid-cols-2 gap-2"
  >
    <div>
      <label
        :for="id('min')"
        :class="labelClass"
      >Minimum</label>
      <input
        :id="id('min')"
        v-model.number="draft.min"
        data-input="min"
        type="number"
        :aria-invalid="invalid('min') || undefined"
        :class="inputClass"
      >
    </div>
    <div>
      <label
        :for="id('max')"
        :class="labelClass"
      >Maximum</label>
      <input
        :id="id('max')"
        v-model.number="draft.max"
        data-input="max"
        type="number"
        :aria-invalid="invalid('max') || undefined"
        :class="inputClass"
      >
    </div>
  </div>

  <div v-else-if="draft.type === 'birthDate'">
    <label
      :for="id('age')"
      :class="labelClass"
    >Mindestalter (Jahre)</label>
    <input
      :id="id('age')"
      v-model.number="draft.minAge"
      data-input="minAge"
      type="number"
      min="0"
      max="120"
      :aria-invalid="invalid('minAge') || undefined"
      :class="inputClass"
    >
  </div>

  <div v-else-if="draft.type === 'checkbox'">
    <label
      :for="id('checked')"
      :class="labelClass"
    >Zustand</label>
    <select
      :id="id('checked')"
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
</template>
