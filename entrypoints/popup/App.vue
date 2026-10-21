<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { browser } from 'wxt/browser'
import { isProblem, summarizeReport } from '../../src/fill/reportSummary'
import type { FillMode } from '../../src/fill/messages'
import type { Template } from '../../src/model/types'
import { usePopup } from '../../src/popup/usePopup'
import FillReportView from '../../src/ui/FillReportView.vue'
import Segmented from '../../src/ui/Segmented.vue'
import type { SegmentedOption } from '../../src/ui/segmented'

const popup = usePopup()
const { app, detected, apps, templates, mode, report, busy, error, notice, pageSupported, suggestedPattern, tabId } = popup

const loaded = ref(false)
const modeOptions: SegmentedOption<FillMode>[] = [
  { value: 'all', label: 'Alle Felder' },
  { value: 'required', label: 'Nur Pflicht' },
]

const openMenuId = ref<string | null>(null)
const showReport = ref(false)
const showAppPicker = ref(false)
const showNewTemplate = ref(false)
const newTemplateName = ref('')
const newAppName = ref('')
const newAppPattern = ref('')
const shortcut = ref('')

const newTemplateInput = ref<HTMLInputElement | null>(null)
const appPicker = ref<HTMLSelectElement | null>(null)
const appPickerToggle = ref<HTMLButtonElement | null>(null)

onMounted(async () => {
  await popup.load()
  newAppPattern.value = suggestedPattern.value
  loaded.value = true
  try {
    const commands = await browser.commands.getAll()
    shortcut.value = commands.find((c) => c.name === 'fill-last')?.shortcut ?? ''
  } catch {
    // Only the hint text depends on it.
  }
})

const otherApps = computed(() => apps.value.filter((a) => a.id !== app.value?.id))
const hasProblems = computed(() => report.value?.fields.some((f) => isProblem(f.status)) ?? false)

const statusText = computed(() => {
  if (busy.value) return 'Bitte warten …'
  if (notice.value) return notice.value
  const r = report.value
  if (!r || r.error !== undefined) return ''
  const name = templates.value.find((t) => t.id === r.templateId)?.name
  return name ? `${name}: ${summarizeReport(r)}` : summarizeReport(r)
})

// A new run replaces the report; keep the protocol closed until asked for again.
watch(report, () => {
  showReport.value = false
})

function processLabel(t: Template): string {
  return t.process ? `${t.process.name} · Schritt ${t.process.step}` : ''
}

function toggleMenu(id: string): void {
  openMenuId.value = openMenuId.value === id ? null : id
}

function closeMenu(id: string): void {
  openMenuId.value = null
  document.getElementById(`menu-button-${id}`)?.focus()
}

async function recordFields(id: string): Promise<void> {
  openMenuId.value = null
  await popup.record(id)
}

async function edit(): Promise<void> {
  openMenuId.value = null
  await popup.openManage()
}

async function toggleNewTemplate(): Promise<void> {
  showNewTemplate.value = !showNewTemplate.value
  if (showNewTemplate.value) {
    await nextTick()
    newTemplateInput.value?.focus()
  }
}

async function submitNewTemplate(): Promise<void> {
  const name = newTemplateName.value
  await popup.newTemplate(name)
  // Only an empty name keeps the form open; a failing recording start is reported separately.
  if (name.trim() !== '') {
    newTemplateName.value = ''
    showNewTemplate.value = false
  }
}

async function toggleAppPicker(): Promise<void> {
  showAppPicker.value = !showAppPicker.value
  if (showAppPicker.value) {
    await nextTick()
    appPicker.value?.focus()
  }
}

async function onPickApp(event: Event): Promise<void> {
  const id = (event.target as HTMLSelectElement).value
  if (!id) return
  showAppPicker.value = false
  await popup.chooseApp(id)
  appPickerToggle.value?.focus()
}

function submitNewApp(): void {
  // Called straight from the submit event: the permission prompt needs the user gesture.
  void popup.createAppForCurrentPage(newAppName.value, newAppPattern.value)
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
const secondaryButton = `rounded-lg border border-zinc-500 bg-white px-2.5 py-1.5 font-medium text-zinc-900 hover:bg-zinc-100 ${focusRing}`
const primaryButton = `rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700 ${focusRing}`
const linkButton = `rounded-md px-1 py-1 font-medium text-blue-700 hover:underline ${focusRing}`
const textInput = `w-full rounded-lg border border-zinc-500 bg-white px-2.5 py-1.5 text-zinc-900 ${focusRing}`
</script>

<template>
  <div class="w-[360px] bg-white text-[13px] leading-snug text-zinc-900">
    <header class="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5">
      <h1 class="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <span class="truncate">{{ app?.name ?? 'Form Filler' }}</span>
        <span
          v-if="app"
          class="shrink-0 rounded-full bg-zinc-200 px-2 py-px text-[11px] font-medium text-zinc-800"
        >{{ detected ? 'erkannt' : 'manuell gewählt' }}</span>
      </h1>
      <button
        type="button"
        :class="`shrink-0 rounded-md p-1.5 text-zinc-700 hover:bg-zinc-100 ${focusRing}`"
        aria-label="Vorlagen verwalten"
        title="Vorlagen verwalten"
        @click="popup.openManage()"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          class="size-4"
          fill="currentColor"
        ><path
          fill-rule="evenodd"
          d="M7.84 1.8A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.8l.3 1.5c.47.2.91.45 1.31.76l1.45-.49a1 1 0 0 1 1.19.45l1.18 2.04a1 1 0 0 1-.2 1.25l-1.15 1.01a6 6 0 0 1 0 1.52l1.15 1.01a1 1 0 0 1 .2 1.25l-1.18 2.04a1 1 0 0 1-1.19.45l-1.45-.49c-.4.31-.84.57-1.31.76l-.3 1.5a1 1 0 0 1-.98.8H8.82a1 1 0 0 1-.98-.8l-.3-1.5a6 6 0 0 1-1.31-.76l-1.45.49a1 1 0 0 1-1.19-.45L2.41 13.1a1 1 0 0 1 .2-1.25l1.15-1.01a6 6 0 0 1 0-1.52L2.61 8.3a1 1 0 0 1-.2-1.25l1.18-2.04a1 1 0 0 1 1.19-.45l1.45.49c.4-.31.84-.56 1.31-.76l.3-1.5ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
          clip-rule="evenodd"
        /></svg>
      </button>
    </header>

    <main class="grid gap-3 p-3">
      <p
        v-if="loaded && tabId === null"
        class="text-zinc-700"
      >
        Kein aktiver Tab gefunden.
      </p>

      <p
        v-else-if="loaded && !pageSupported"
        class="text-zinc-700"
      >
        Auf dieser Seite können keine Formulare befüllt werden.
      </p>

      <template v-else-if="loaded && app">
        <Segmented
          :model-value="mode"
          :options="modeOptions"
          label="Umfang"
          @update:model-value="popup.setMode"
        />

        <section aria-labelledby="templates-heading">
          <h2
            id="templates-heading"
            class="mb-1 text-[11px] font-semibold tracking-wide text-zinc-600 uppercase"
          >
            Vorlagen
          </h2>
          <p
            v-if="templates.length === 0"
            class="px-2 py-1.5 text-zinc-700"
          >
            Noch keine Vorlagen für diese App.
          </p>
          <ul
            v-else
            class="grid gap-0.5"
            :aria-busy="busy"
          >
            <li
              v-for="t in templates"
              :key="t.id"
              class="rounded-lg px-2 py-1.5 hover:bg-zinc-50"
            >
              <div class="flex items-center gap-2">
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium">
                    {{ t.name }}
                  </div>
                  <div
                    v-if="processLabel(t)"
                    class="truncate text-xs text-zinc-600"
                  >
                    {{ processLabel(t) }}
                  </div>
                </div>
                <button
                  type="button"
                  :class="secondaryButton"
                  :aria-label="`Füllen: ${t.name}`"
                  @click="popup.fill(t.id)"
                >
                  Füllen
                </button>
                <button
                  :id="`menu-button-${t.id}`"
                  type="button"
                  :class="`rounded-md px-2 py-1 text-base leading-none text-zinc-700 hover:bg-zinc-100 ${focusRing}`"
                  :aria-label="`Weitere Aktionen: ${t.name}`"
                  :aria-expanded="openMenuId === t.id"
                  :aria-controls="`menu-${t.id}`"
                  @click="toggleMenu(t.id)"
                >
                  <span aria-hidden="true">⋯</span>
                </button>
              </div>
              <div
                v-if="openMenuId === t.id"
                :id="`menu-${t.id}`"
                class="mt-1.5 flex gap-2"
                @keydown.esc.stop="closeMenu(t.id)"
              >
                <button
                  type="button"
                  :class="secondaryButton"
                  @click="recordFields(t.id)"
                >
                  Felder aufnehmen
                </button>
                <button
                  type="button"
                  :class="secondaryButton"
                  @click="edit()"
                >
                  Bearbeiten
                </button>
              </div>
            </li>
          </ul>
        </section>

        <div>
          <button
            type="button"
            :class="linkButton"
            :aria-expanded="showNewTemplate"
            aria-controls="new-template-form"
            @click="toggleNewTemplate()"
          >
            + Neue Vorlage
          </button>
          <form
            v-if="showNewTemplate"
            id="new-template-form"
            class="mt-2 grid gap-2"
            @submit.prevent="submitNewTemplate()"
          >
            <label
              for="new-template-name"
              class="font-medium"
            >Name der Vorlage</label>
            <input
              id="new-template-name"
              ref="newTemplateInput"
              v-model="newTemplateName"
              type="text"
              autocomplete="off"
              required
              :class="textInput"
            >
            <div class="flex gap-2">
              <button
                type="submit"
                :class="primaryButton"
              >
                Anlegen und Felder aufnehmen
              </button>
              <button
                type="button"
                :class="secondaryButton"
                @click="showNewTemplate = false"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>

        <button
          type="button"
          :class="secondaryButton"
          @click="popup.newDataset()"
        >
          Neuer Datensatz
        </button>
      </template>

      <template v-else-if="loaded">
        <p class="text-zinc-700">
          Für diese Seite ist keine App hinterlegt.
        </p>
        <form
          class="grid gap-2"
          aria-labelledby="new-app-heading"
          @submit.prevent="submitNewApp()"
        >
          <h2
            id="new-app-heading"
            class="text-sm font-semibold"
          >
            Neue App für diese Seite
          </h2>
          <label
            for="new-app-name"
            class="font-medium"
          >Name</label>
          <input
            id="new-app-name"
            v-model="newAppName"
            type="text"
            autocomplete="off"
            required
            :class="textInput"
          >
          <label
            for="new-app-pattern"
            class="font-medium"
          >URL-Muster</label>
          <input
            id="new-app-pattern"
            v-model="newAppPattern"
            type="text"
            autocomplete="off"
            spellcheck="false"
            required
            aria-describedby="new-app-pattern-hint"
            :class="`${textInput} font-mono text-xs`"
          >
          <p
            id="new-app-pattern-hint"
            class="text-xs text-zinc-600"
          >
            * steht für beliebige Zeichen. Der Browser fragt danach nach der Berechtigung für diese Adresse.
          </p>
          <button
            type="submit"
            :class="primaryButton"
          >
            App anlegen
          </button>
        </form>
      </template>

      <div
        v-if="error"
        role="alert"
        class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-800"
      >
        <p>{{ error.message }}</p>
        <details
          v-if="error.detail"
          class="mt-1 text-xs"
        >
          <summary :class="`cursor-pointer rounded ${focusRing}`">
            Technische Details
          </summary>
          <p class="mt-1 font-mono break-words">
            {{ error.detail }}
          </p>
        </details>
      </div>

      <div class="grid gap-2">
        <div class="flex items-center justify-between gap-2">
          <p
            role="status"
            aria-live="polite"
            class="min-w-0"
            :class="hasProblems ? 'text-amber-800' : 'text-zinc-700'"
          >
            {{ statusText }}
          </p>
          <button
            v-if="report && report.fields.length > 0 && !busy"
            type="button"
            :class="`shrink-0 ${linkButton}`"
            :aria-expanded="showReport"
            aria-controls="fill-report"
            @click="showReport = !showReport"
          >
            {{ showReport ? 'Details ausblenden' : 'Details' }}
          </button>
        </div>
        <FillReportView
          v-if="showReport && report"
          id="fill-report"
          :report="report"
        />
      </div>
    </main>

    <footer
      v-if="loaded && pageSupported && tabId !== null"
      class="grid gap-2 border-t border-zinc-200 px-3 py-2.5 text-xs text-zinc-600"
    >
      <div v-if="otherApps.length > 0">
        <button
          ref="appPickerToggle"
          type="button"
          :class="`rounded-md py-1 font-medium text-zinc-700 hover:underline ${focusRing}`"
          :aria-expanded="showAppPicker"
          aria-controls="app-picker"
          @click="toggleAppPicker()"
        >
          {{ app ? 'Andere App wählen' : 'Vorhandene App wählen' }}
        </button>
        <div
          v-if="showAppPicker"
          id="app-picker"
          class="mt-1.5"
        >
          <label
            for="app-picker-select"
            class="sr-only"
          >App</label>
          <select
            id="app-picker-select"
            ref="appPicker"
            :class="`${textInput} text-[13px]`"
            @change="onPickApp"
          >
            <option value="">
              App auswählen …
            </option>
            <option
              v-for="a in otherApps"
              :key="a.id"
              :value="a.id"
            >
              {{ a.name }}
            </option>
          </select>
        </div>
      </div>
      <p v-if="app">
        <template v-if="shortcut">
          <kbd class="rounded border border-zinc-400 px-1 font-mono text-[11px] text-zinc-800">{{ shortcut }}</kbd>
          füllt mit der zuletzt genutzten Vorlage.
        </template>
        <template v-else>
          Tastenkürzel für „zuletzt genutzte Vorlage“ unter chrome://extensions/shortcuts festlegen.
        </template>
      </p>
    </footer>
  </div>
</template>
