<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { AppDef, DataTypeConfig, FieldRule, Template } from '../model/types'
import { validateConfig, type ConfigError } from '../model/validateConfig'
import { clone, configFor, typeGroups } from '../recorder/useRecorder'
import ConfigEditor from '../ui/ConfigEditor.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import { finalizeConfig, hasOptions, RUN_ID_NOT_APPLICABLE, runIdApplies, slotOptions } from '../ui/configOptions'
import { useDialog } from '../ui/dialog'
import { TEMPLATES_HEADING_ID } from './ids'
import { count, type ManageState } from './useManage'

defineOptions({ name: 'TemplateTable' })

const props = defineProps<{
  app: AppDef
  template: Template
  busy: boolean
  actions: Pick<ManageState, 'updateField' | 'removeField' | 'moveField' | 'saveTemplateMeta' | 'removeTemplate' | 'recordFields'>
}>()

const uid = useId()
const root = ref<HTMLElement | null>(null)
const recordButton = ref<HTMLButtonElement | null>(null)
const confirm = useDialog<'delete'>()

// --- Template meta (name, process, step) -------------------------------------------------------

const meta = ref({ name: '', processName: '', step: 1 })

// Compared by value: every storage refresh hands in a new template object, which must not wipe typing.
watch(
  () => JSON.stringify([props.template.name, props.template.process]),
  () => {
    meta.value = {
      name: props.template.name,
      processName: props.template.process?.name ?? '',
      step: props.template.process?.step ?? 1,
    }
  },
  { immediate: true },
)

const metaDirty = computed(
  () =>
    meta.value.name !== props.template.name ||
    meta.value.processName !== (props.template.process?.name ?? '') ||
    (meta.value.processName !== '' && meta.value.step !== (props.template.process?.step ?? 1)),
)

async function saveMeta(): Promise<void> {
  const { name, processName, step } = meta.value
  await props.actions.saveTemplateMeta({ name, process: processName.trim() === '' ? null : { name: processName, step } })
}

async function removeTemplate(): Promise<void> {
  const choice = await confirm.ask({
    title: 'Vorlage löschen?',
    message: `Die Vorlage „${props.template.name}“ mit ${count(props.template.fields.length, 'Feld', 'Feldern')} wird endgültig gelöscht.`,
    choices: [{ value: 'delete', label: 'Vorlage löschen', tone: 'danger' }],
  })
  if (choice !== 'delete') return
  // This table unmounts with its template; continue in the template list.
  if (await props.actions.removeTemplate(props.template.id)) {
    void nextTick(() => document.getElementById(TEMPLATES_HEADING_ID)?.focus())
  }
}

// --- Rows ----------------------------------------------------------------------------------------

const missing = computed(() => new Set(props.template.lastMissing))

function displayName(field: FieldRule): string {
  return field.label.trim() || field.locator.name || field.locator.id || 'Feld'
}

function locatorHint(field: FieldRule): string {
  const { name, id } = field.locator
  return name ? `name=${name}` : id ? `id=${id}` : ''
}

/** Slot choices computed once per row instead of on every template access. */
const rows = computed(() =>
  props.template.fields.map((field) => ({
    field,
    slots: slotOptions(props.template.fields, field.config, field.slot, field.id),
  })),
)

function onLabelChange(field: FieldRule, event: Event): void {
  const input = event.target as HTMLInputElement
  const label = input.value.trim()
  // An empty label would leave the row without a readable name; fall back to the stored one.
  if (label === '') {
    input.value = field.label
    return
  }
  if (label !== field.label) void props.actions.updateField(field.id, { label })
}

async function onTypeChange(field: FieldRule, event: Event): Promise<void> {
  const type = (event.target as HTMLSelectElement).value as DataTypeConfig['type']
  const config = configFor(type, [field.config])
  const ok = await props.actions.updateField(field.id, { config })
  // On failure the stored type is unchanged; the select must not keep showing the rejected one.
  if (!ok) (event.target as HTMLSelectElement).value = field.config.type
  if (ok && hasOptions(type)) openOptions(field.id, config)
  else if (expanded.value === field.id) closeOptions(false)
}

function onSlotChange(field: FieldRule, event: Event): void {
  void props.actions.updateField(field.id, { slot: (event.target as HTMLSelectElement).value })
}

function onToggle(field: FieldRule, key: 'required' | 'appendRunId', event: Event): void {
  void props.actions.updateField(field.id, { [key]: (event.target as HTMLInputElement).checked })
}

function focusIn(selector: string): void {
  void nextTick(() => root.value?.querySelector<HTMLElement>(selector)?.focus())
}

async function move(field: FieldRule, delta: -1 | 1): Promise<void> {
  const index = props.template.fields.findIndex((f) => f.id === field.id)
  if (!(await props.actions.moveField(field.id, index + delta))) return
  // Vue moves the row's DOM node, which drops focus; keep it on the moved row's buttons.
  const last = props.template.fields.length - 1
  const newIndex = props.template.fields.findIndex((f) => f.id === field.id)
  const direction = delta === -1 ? (newIndex === 0 ? 'down' : 'up') : newIndex === last ? 'up' : 'down'
  focusIn(`[data-move="${direction}-${field.id}"]`)
}

async function removeField(field: FieldRule): Promise<void> {
  const choice = await confirm.ask({
    title: 'Feld löschen?',
    message: `Das Feld „${displayName(field)}“ wird aus der Vorlage entfernt.`,
    choices: [{ value: 'delete', label: 'Feld löschen', tone: 'danger' }],
  })
  if (choice !== 'delete') return
  const fields = props.template.fields
  const index = fields.findIndex((f) => f.id === field.id)
  const neighbour = fields[index + 1] ?? fields[index - 1]
  if (expanded.value === field.id) closeOptions(false)
  if (!(await props.actions.removeField(field.id))) return
  if (neighbour) focusIn(`[data-remove="${neighbour.id}"]`)
  else void nextTick(() => recordButton.value?.focus())
}

// --- Options row ---------------------------------------------------------------------------------

const expanded = ref<string | null>(null)
const optionDraft = ref<DataTypeConfig | null>(null)
const optionError = ref<ConfigError | null>(null)

function openOptions(fieldId: string, config: DataTypeConfig): void {
  expanded.value = fieldId
  optionDraft.value = clone(config)
  // A freshly picked type often starts incomplete (e.g. an empty list); say so right away.
  optionError.value = validateConfig(config)
  focusIn(`#${CSS.escape(`${uid}-opt-${fieldId}`)} :is(input, select, textarea)`)
}

function closeOptions(restoreFocus = true): void {
  const id = expanded.value
  expanded.value = null
  optionDraft.value = null
  optionError.value = null
  if (restoreFocus && id !== null) focusIn(`[data-options="${id}"]`)
}

function toggleOptions(field: FieldRule): void {
  if (expanded.value === field.id) closeOptions()
  else openOptions(field.id, field.config)
}

async function applyOptions(field: FieldRule): Promise<void> {
  const draft = optionDraft.value
  if (draft === null) return
  const config = finalizeConfig(draft)
  const problem = validateConfig(config)
  optionError.value = problem
  if (problem) {
    focusIn(`#${CSS.escape(`${uid}-opt-${field.id}`)} [data-input="${problem.input}"]`)
    return
  }
  if (await props.actions.updateField(field.id, { config })) closeOptions()
}

function incomplete(field: FieldRule): boolean {
  return validateConfig(field.config) !== null
}

// --- Drag and drop -------------------------------------------------------------------------------

const dragId = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(field: FieldRule, event: DragEvent): void {
  dragId.value = field.id
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', field.id)
  const row = (event.target as HTMLElement).closest('tr')
  if (row) event.dataTransfer.setDragImage(row, 16, 16)
}

function onDragOver(index: number, event: DragEvent): void {
  if (dragId.value === null) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropIndex.value = index
}

async function onDrop(index: number, event: DragEvent): Promise<void> {
  const id = dragId.value
  event.preventDefault()
  onDragEnd()
  if (id === null) return
  // The marker sits on the target row's top edge (insert before it). moveField indexes the list
  // without the dragged row, so a downward move lands one slot earlier.
  const from = props.template.fields.findIndex((f) => f.id === id)
  await props.actions.moveField(id, from !== -1 && from < index ? index - 1 : index)
}

function onDragEnd(): void {
  dragId.value = null
  dropIndex.value = null
}

const iconButton =
  'inline-flex size-7 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600'
const control =
  'block w-full rounded-md border border-zinc-500 bg-white px-2 py-1 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600'
const switchClass =
  "relative h-5 w-9 cursor-pointer appearance-none rounded-full bg-zinc-500 transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-4 before:rounded-full before:bg-white before:shadow before:transition-transform before:content-[''] checked:bg-blue-700 checked:before:translate-x-4 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
const secondaryButton =
  'rounded-md border border-zinc-500 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
const primaryButton =
  'rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
const labelClass = 'block text-xs font-medium text-zinc-700'
</script>

<template>
  <section
    ref="root"
    :aria-labelledby="`${uid}-heading`"
    class="min-w-0 rounded-xl border border-zinc-300 bg-white"
  >
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
      <h2
        :id="`${uid}-heading`"
        tabindex="-1"
        class="text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {{ app.name }} › {{ template.name }}<span
          v-if="template.process"
          class="font-normal text-zinc-600"
        > · {{ template.process.name }}, Schritt {{ template.process.step }}</span>
      </h2>
      <button
        ref="recordButton"
        type="button"
        :class="secondaryButton"
        :disabled="busy"
        :aria-describedby="`${uid}-record-hint`"
        @click="actions.recordFields()"
      >
        + Felder aufnehmen
      </button>
      <p
        :id="`${uid}-record-hint`"
        class="sr-only"
      >
        Wechselt zum zuletzt genutzten Tab der App und startet dort die Aufnahme.
      </p>
    </header>

    <form
      class="flex flex-wrap items-end gap-3 border-b border-zinc-200 px-4 py-3"
      novalidate
      @submit.prevent="saveMeta"
    >
      <div class="min-w-48 flex-1">
        <label
          :for="`${uid}-name`"
          :class="labelClass"
        >Name der Vorlage</label>
        <input
          :id="`${uid}-name`"
          v-model="meta.name"
          type="text"
          required
          :class="[control, 'mt-1']"
        >
      </div>
      <div class="min-w-40 flex-1">
        <label
          :for="`${uid}-process`"
          :class="labelClass"
        >Prozess (optional)</label>
        <input
          :id="`${uid}-process`"
          v-model="meta.processName"
          type="text"
          :aria-describedby="`${uid}-process-hint`"
          :class="[control, 'mt-1']"
        >
      </div>
      <div class="w-20">
        <label
          :for="`${uid}-step`"
          :class="labelClass"
        >Schritt</label>
        <input
          :id="`${uid}-step`"
          v-model.number="meta.step"
          type="number"
          min="1"
          step="1"
          :disabled="meta.processName.trim() === ''"
          :class="[control, 'mt-1 disabled:bg-zinc-100 disabled:text-zinc-600']"
        >
      </div>
      <div class="flex gap-2">
        <button
          type="submit"
          :class="primaryButton"
          :disabled="!metaDirty"
        >
          Speichern
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          @click="removeTemplate"
        >
          Vorlage löschen
        </button>
      </div>
      <p
        :id="`${uid}-process-hint`"
        class="w-full text-xs text-zinc-600"
      >
        Alle Schritte eines Prozesses teilen sich denselben Datensatz.
      </p>
    </form>

    <p
      v-if="template.fields.length === 0"
      class="px-4 py-6 text-sm text-zinc-700"
    >
      Diese Vorlage hat noch keine Felder. Öffne die Seite der App und nimm sie mit „+ Felder aufnehmen“ auf.
    </p>

    <div
      v-else
      class="overflow-x-auto"
    >
      <table class="w-full border-collapse text-sm">
        <caption class="sr-only">
          Felder der Vorlage „{{ template.name }}“ in Füllreihenfolge. Änderungen werden sofort gespeichert.
        </caption>
        <thead>
          <tr class="border-b border-zinc-200 text-left text-xs font-medium tracking-wide text-zinc-600 uppercase">
            <th
              scope="col"
              class="w-24 px-3 py-2"
            >
              <span class="sr-only">Reihenfolge</span>
            </th>
            <th
              scope="col"
              class="px-2 py-2"
            >
              Feld
            </th>
            <th
              scope="col"
              class="px-2 py-2"
            >
              Datentyp
            </th>
            <th
              scope="col"
              class="px-2 py-2"
            >
              Slot
            </th>
            <th
              scope="col"
              class="px-2 py-2 text-center"
            >
              Pflicht
            </th>
            <th
              scope="col"
              class="px-2 py-2 text-center"
            >
              Kennung
            </th>
            <th
              scope="col"
              class="px-3 py-2"
            >
              <span class="sr-only">Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="({ field, slots }, index) in rows"
            :key="field.id"
          >
            <tr
              class="border-b border-zinc-100 align-middle"
              :class="{
                'bg-blue-50': expanded === field.id,
                'opacity-50': dragId === field.id,
                'shadow-[inset_0_2px_0_0_var(--color-blue-700)]': dropIndex === index && dragId !== field.id,
              }"
              @dragover="onDragOver(index, $event)"
              @drop="onDrop(index, $event)"
            >
              <td class="px-3 py-1.5 whitespace-nowrap">
                <span
                  draggable="true"
                  class="mr-1 inline-flex size-7 cursor-grab items-center justify-center rounded-md text-zinc-600 select-none hover:bg-zinc-100 active:cursor-grabbing"
                  title="Ziehen zum Umsortieren"
                  aria-hidden="true"
                  @dragstart="onDragStart(field, $event)"
                  @dragend="onDragEnd"
                >⋮⋮</span>
                <button
                  type="button"
                  :class="iconButton"
                  :data-move="`up-${field.id}`"
                  :disabled="index === 0"
                  :aria-label="`„${displayName(field)}“ nach oben`"
                  title="Nach oben"
                  @click="move(field, -1)"
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  :class="iconButton"
                  :data-move="`down-${field.id}`"
                  :disabled="index === template.fields.length - 1"
                  :aria-label="`„${displayName(field)}“ nach unten`"
                  title="Nach unten"
                  @click="move(field, 1)"
                >
                  <span aria-hidden="true">↓</span>
                </button>
              </td>
              <td class="min-w-44 px-2 py-1.5">
                <input
                  type="text"
                  :value="field.label"
                  :aria-label="`Bezeichnung von Feld ${index + 1}`"
                  :aria-describedby="missing.has(field.id) ? `${uid}-missing-${field.id}` : undefined"
                  :class="control"
                  @change="onLabelChange(field, $event)"
                >
                <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                  <span
                    v-if="missing.has(field.id)"
                    :id="`${uid}-missing-${field.id}`"
                    class="font-medium text-amber-800"
                    title="Beim letzten Füllen problematisch"
                  ><span aria-hidden="true">⚠ </span>Beim letzten Füllen problematisch</span>
                  <span
                    v-if="locatorHint(field)"
                    class="truncate text-zinc-600"
                  >{{ locatorHint(field) }}</span>
                </div>
              </td>
              <td class="min-w-44 px-2 py-1.5">
                <select
                  :value="field.config.type"
                  :aria-label="`Datentyp für „${displayName(field)}“`"
                  :aria-describedby="incomplete(field) ? `${uid}-incomplete-${field.id}` : undefined"
                  :class="control"
                  @change="onTypeChange(field, $event)"
                >
                  <optgroup
                    v-for="group in typeGroups(field.locator.kind, field.config.type)"
                    :key="group.group"
                    :label="group.group"
                  >
                    <option
                      v-for="type in group.types"
                      :key="type.type"
                      :value="type.type"
                    >
                      {{ type.label }}
                    </option>
                  </optgroup>
                </select>
                <p
                  v-if="incomplete(field)"
                  :id="`${uid}-incomplete-${field.id}`"
                  class="mt-0.5 text-xs font-medium text-red-700"
                >
                  Optionen unvollständig
                </p>
              </td>
              <td class="min-w-32 px-2 py-1.5">
                <select
                  v-if="slots.length > 0"
                  :value="field.slot ?? ''"
                  :aria-label="`Slot für „${displayName(field)}“`"
                  :class="control"
                  @change="onSlotChange(field, $event)"
                >
                  <option
                    v-for="slot in slots"
                    :key="slot.value"
                    :value="slot.value"
                  >
                    {{ slot.label }}
                  </option>
                </select>
                <span
                  v-else
                  class="text-zinc-600"
                ><span aria-hidden="true">–</span><span class="sr-only">kein Slot</span></span>
              </td>
              <td class="px-2 py-1.5 text-center">
                <input
                  type="checkbox"
                  role="switch"
                  :checked="field.required"
                  :aria-label="`Pflichtfeld „${displayName(field)}“`"
                  :class="switchClass"
                  @change="onToggle(field, 'required', $event)"
                >
              </td>
              <td class="px-2 py-1.5 text-center">
                <input
                  type="checkbox"
                  role="switch"
                  :checked="field.appendRunId"
                  :disabled="!runIdApplies(field.locator.kind, field.config)"
                  :title="runIdApplies(field.locator.kind, field.config) ? undefined : RUN_ID_NOT_APPLICABLE"
                  :aria-describedby="runIdApplies(field.locator.kind, field.config) ? undefined : `${uid}-runid-na`"
                  :aria-label="`Kennung an „${displayName(field)}“ anhängen`"
                  :class="switchClass"
                  @change="onToggle(field, 'appendRunId', $event)"
                >
              </td>
              <td class="px-3 py-1.5 text-right whitespace-nowrap">
                <button
                  v-if="hasOptions(field.config.type)"
                  type="button"
                  class="rounded-md px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                  :data-options="field.id"
                  :aria-expanded="expanded === field.id"
                  :aria-controls="expanded === field.id ? `${uid}-opt-${field.id}` : undefined"
                  :aria-label="`Optionen für „${displayName(field)}“`"
                  @click="toggleOptions(field)"
                >
                  Optionen <span aria-hidden="true">{{ expanded === field.id ? '▴' : '▾' }}</span>
                </button>
                <button
                  type="button"
                  :class="[iconButton, 'ml-1 hover:bg-red-50 hover:text-red-700']"
                  :data-remove="field.id"
                  :aria-label="`Feld „${displayName(field)}“ löschen`"
                  title="Feld löschen"
                  @click="removeField(field)"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </td>
            </tr>
            <tr
              v-if="expanded === field.id && optionDraft !== null"
              class="border-b border-zinc-200 bg-blue-50"
            >
              <td
                colspan="7"
                class="px-4 pt-1 pb-4"
              >
                <form
                  :id="`${uid}-opt-${field.id}`"
                  role="group"
                  :aria-label="`Optionen für „${displayName(field)}“`"
                  class="max-w-xl space-y-3"
                  novalidate
                  @submit.prevent="applyOptions(field)"
                  @keydown.esc.prevent="closeOptions()"
                >
                  <ConfigEditor
                    :model-value="optionDraft"
                    :error="optionError"
                    :id-prefix="`${uid}-cfg-${field.id}`"
                    @update:model-value="optionDraft = $event"
                  />
                  <p
                    v-if="optionError"
                    role="alert"
                    class="text-xs font-medium text-red-700"
                  >
                    {{ optionError.message }}
                  </p>
                  <div class="flex gap-2">
                    <button
                      type="submit"
                      :class="primaryButton"
                    >
                      Übernehmen
                    </button>
                    <button
                      type="button"
                      :class="secondaryButton"
                      @click="closeOptions()"
                    >
                      Abbrechen
                    </button>
                  </div>
                </form>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <!-- Description target for disabled "Kennung" switches; aria-describedby may point to hidden text. -->
      <p
        :id="`${uid}-runid-na`"
        hidden
      >
        {{ RUN_ID_NOT_APPLICABLE }}
      </p>
    </div>

    <ConfirmDialog
      :request="confirm.request.value"
      @choose="confirm.choose"
    />
  </section>
</template>
