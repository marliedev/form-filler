<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { browser } from 'wxt/browser'
import { isProblem, summarizeReport } from '../../src/fill/reportSummary'
import type { FillMode } from '../../src/fill/messages'
import type { Template } from '../../src/model/types'
import { usePopup } from '../../src/popup/usePopup'
import BrandSignet from '../../src/theme/BrandSignet.vue'
import FillReportView from '../../src/ui/FillReportView.vue'
import { SHORTCUTS_PAGE_HINT } from '../../src/popup/browserHints'
import Segmented from '../../src/ui/Segmented.vue'
import type { SegmentedOption } from '../../src/ui/segmented'

const popup = usePopup()
const { app, detected, apps, templates, mode, report, busy, error, notice, pageSupported, suggestedPattern, tabId, permissionMissing } = popup

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
const pickedAppId = ref('')
const heading = ref<HTMLHeadingElement | null>(null)

/** The heading survives every view switch, so focus never falls back to <body>. */
async function focusHeading(): Promise<void> {
  await nextTick()
  heading.value?.focus()
}

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

/** Dot color of the status line; the text itself stays neutral. */
const statusTone = computed(() => {
  if (busy.value || notice.value || !report.value) return 'bg-info'
  return hasProblems.value ? 'bg-warning' : 'bg-success'
})

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
  // A failing recording start is reported in the status area; the saved template stays in the list.
  if (await popup.newTemplate(newTemplateName.value)) {
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

// Switching only on explicit confirmation: arrow keys fire `change` on some platforms (WCAG 3.2.2).
async function confirmAppPick(): Promise<void> {
  if (!pickedAppId.value) return
  const id = pickedAppId.value
  pickedAppId.value = ''
  showAppPicker.value = false
  await popup.chooseApp(id)
  await focusHeading()
}

function submitNewApp(): void {
  // Called straight from the submit event: the permission prompt needs the user gesture.
  void popup.createAppForCurrentPage(newAppName.value, newAppPattern.value).then(async (created) => {
    if (created) await focusHeading()
  })
}

const focusRing = 'focus-visible:focus-ring'
const secondaryButton = `rounded-sm border border-line px-3 py-1.5 font-medium text-text hover:bg-line ${focusRing}`
const primaryButton = `rounded-sm bg-brand px-3.5 py-1.5 font-medium whitespace-nowrap text-on-brand hover:brightness-125 ${focusRing}`
const linkButton = `rounded-sm px-0.5 py-1 text-brand-fg underline underline-offset-3 hover:text-brand-fg-strong ${focusRing}`
const textInput = `w-full rounded-sm border border-muted bg-surface px-2.5 py-1.5 text-text ${focusRing}`
</script>

<template>
  <div class="w-[360px] bg-bg text-sm leading-normal font-light text-text">
    <header class="flex items-center gap-3 px-4.5 pt-4.5 pb-3.5">
      <BrandSignet class="h-[18px] w-[30px] shrink-0 text-text" />
      <h1
        ref="heading"
        tabindex="-1"
        class="min-w-0 rounded-sm focus-visible:focus-ring"
      >
        <span class="block truncate font-display text-xl leading-tight font-bold tracking-[-0.01em]">{{ app?.name ?? 'Form Filler' }}</span>
        <span
          v-if="app"
          class="sr-only"
        >, </span>
        <span
          v-if="app"
          class="mt-0.5 block text-xs text-muted"
        >{{ detected ? 'An der Adresse erkannt' : 'Manuell gewählt' }}</span>
      </h1>
      <button
        type="button"
        :class="`ml-auto grid size-8 shrink-0 place-items-center rounded-sm text-text hover:bg-surface ${focusRing}`"
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

    <main class="grid gap-3.5 px-4.5 pt-1 pb-4.5">
      <p
        v-if="loaded && tabId === null"
        class="text-muted"
      >
        Kein aktiver Tab gefunden.
      </p>

      <p
        v-else-if="loaded && !pageSupported"
        class="text-muted"
      >
        Auf dieser Seite können keine Formulare befüllt werden.
      </p>

      <template v-else-if="loaded && app">
        <div
          v-if="permissionMissing"
          class="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface px-3 py-2.5"
        >
          <span
            aria-hidden="true"
            class="mt-1.5 size-2.5 shrink-0 rounded-full bg-warning"
          />
          <div class="grid gap-2">
            <p>
              <strong class="font-medium">Berechtigung fehlt.</strong>
              Ohne Freigabe für diese Adresse kann das Tastenkürzel hier nicht befüllen.
            </p>
            <button
              type="button"
              :class="`justify-self-start ${secondaryButton}`"
              @click="popup.grantPermission()"
            >
              Berechtigung erteilen
            </button>
          </div>
        </div>

        <Segmented
          :model-value="mode"
          :options="modeOptions"
          label="Umfang"
          @update:model-value="popup.setMode"
        />

        <section aria-labelledby="templates-heading">
          <h2
            id="templates-heading"
            class="mb-2 text-xs font-medium text-muted"
          >
            Vorlagen
          </h2>
          <p
            v-if="templates.length === 0"
            class="text-muted"
          >
            Noch keine Vorlagen für diese App.
          </p>
          <ul
            v-else
            class="grid gap-2"
            :aria-busy="busy"
          >
            <li
              v-for="t in templates"
              :key="t.id"
              class="rounded-xl border border-border-subtle bg-surface py-2.5 pr-2.5 pl-3.5"
            >
              <div class="flex items-center gap-2">
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium">
                    {{ t.name }}
                  </div>
                  <div
                    v-if="processLabel(t)"
                    class="truncate text-xs text-muted"
                  >
                    {{ processLabel(t) }}
                  </div>
                </div>
                <button
                  type="button"
                  :class="primaryButton"
                  :aria-label="`Füllen: ${t.name}`"
                  @click="popup.fill(t.id)"
                >
                  Füllen
                </button>
                <button
                  :id="`menu-button-${t.id}`"
                  type="button"
                  :class="`rounded-sm px-2 py-1.5 text-base leading-none text-muted hover:bg-line hover:text-text ${focusRing}`"
                  :aria-label="`Weitere Aktionen: ${t.name}`"
                  :aria-expanded="openMenuId === t.id"
                  :aria-controls="`menu-${t.id}`"
                  @click="toggleMenu(t.id)"
                  @keydown.esc="openMenuId === t.id && closeMenu(t.id)"
                >
                  <span aria-hidden="true">⋯</span>
                </button>
              </div>
              <div
                v-if="openMenuId === t.id"
                :id="`menu-${t.id}`"
                class="mt-2 flex flex-wrap gap-2"
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
                <button
                  type="button"
                  :class="secondaryButton"
                  title="Verwirft die Testdaten dieses Tabs; beim nächsten Füllen entstehen neue."
                  @click="popup.newDataset()"
                >
                  Neuer Datensatz
                </button>
              </div>
            </li>
          </ul>
        </section>

        <div>
          <button
            type="button"
            :class="`w-full rounded-xl border border-dashed border-brand-fg px-3 py-2.5 font-medium text-brand-fg hover:bg-surface hover:text-brand-fg-strong ${focusRing}`"
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
      </template>

      <template v-else-if="loaded">
        <p class="text-muted">
          Für diese Seite ist keine App hinterlegt.
        </p>
        <form
          class="grid gap-2"
          aria-labelledby="new-app-heading"
          @submit.prevent="submitNewApp()"
        >
          <h2
            id="new-app-heading"
            class="font-display text-base font-semibold"
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
            class="text-xs text-muted"
          >
            * steht für beliebige Zeichen. Der Browser fragt danach nach der Berechtigung für diese Adresse.
          </p>
          <button
            type="submit"
            :class="`justify-self-start ${primaryButton}`"
          >
            App anlegen
          </button>
        </form>
      </template>

      <div
        v-if="error"
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface px-3 py-2.5"
      >
        <span
          aria-hidden="true"
          class="mt-1.5 size-2.5 shrink-0 rounded-full bg-error"
        />
        <div class="min-w-0">
          <p>{{ error.message }}</p>
          <details
            v-if="error.detail"
            class="mt-1 text-xs text-muted"
          >
            <summary :class="`cursor-pointer rounded-sm text-brand-fg underline underline-offset-3 ${focusRing}`">
              Technische Details
            </summary>
            <p class="mt-1 font-mono break-words">
              {{ error.detail }}
            </p>
          </details>
        </div>
      </div>

      <div class="grid gap-2">
        <div
          class="flex items-start gap-2.5"
          :class="{ 'rounded-xl border border-border-subtle px-3 py-2.5': statusText }"
        >
          <span
            v-if="statusText"
            aria-hidden="true"
            class="mt-1.5 size-2.5 shrink-0 rounded-full"
            :class="statusTone"
          />
          <p
            role="status"
            aria-live="polite"
            class="min-w-0 flex-1"
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
      class="grid gap-2 border-t border-line px-4.5 py-3 text-xs text-muted"
    >
      <div v-if="otherApps.length > 0">
        <button
          type="button"
          :class="linkButton"
          :aria-expanded="showAppPicker"
          aria-controls="app-picker"
          @click="toggleAppPicker()"
        >
          {{ app ? 'Andere App wählen' : 'Vorhandene App wählen' }}
        </button>
        <form
          v-if="showAppPicker"
          id="app-picker"
          class="mt-1.5 flex gap-2"
          @submit.prevent="confirmAppPick()"
        >
          <label
            for="app-picker-select"
            class="sr-only"
          >App</label>
          <select
            id="app-picker-select"
            ref="appPicker"
            v-model="pickedAppId"
            :class="`${textInput} min-w-0 flex-1`"
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
          <button
            type="submit"
            :class="`shrink-0 ${secondaryButton}`"
          >
            Wechseln
          </button>
        </form>
      </div>
      <p v-if="app">
        <template v-if="shortcut">
          <kbd class="rounded-sm border border-line px-1.5 font-body text-[11px] font-medium text-text">{{ shortcut }}</kbd>
          füllt mit der zuletzt genutzten Vorlage.
        </template>
        <template v-else>
          Tastenkürzel für „zuletzt genutzte Vorlage“ {{ SHORTCUTS_PAGE_HINT }} festlegen.
        </template>
      </p>
    </footer>
  </div>
</template>
