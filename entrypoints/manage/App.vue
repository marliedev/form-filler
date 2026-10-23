<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { browser } from 'wxt/browser'
import AppList from '../../src/manage/AppList.vue'
import TemplateTable from '../../src/manage/TemplateTable.vue'
import { useManage, type ConflictChoice, type ExportDownload } from '../../src/manage/useManage'
import { toUserError } from '../../src/popup/userError'
import ConfirmDialog from '../../src/ui/ConfirmDialog.vue'
import { useDialog } from '../../src/ui/dialog'
import { appVersion } from '../../src/ui/appVersion'

const version = appVersion()
const manage = useManage()
const { apps, selectedApp, templates, selectedTemplate, busy, error, notice } = manage
const fileInput = ref<HTMLInputElement | null>(null)
const conflict = useDialog<ConflictChoice>()

// The recorder and fills in other tabs write to storage; mirror that here.
function onStorageChanged(_changes: unknown, area: string): void {
  // load() is refresh() with the error shown in the alert region instead of an unhandled rejection.
  if (area === 'local') void manage.load()
}

onMounted(() => {
  void manage.load()
  browser.storage.onChanged.addListener(onStorageChanged)
})

onBeforeUnmount(() => browser.storage.onChanged.removeListener(onStorageChanged))

function download({ filename, content }: ExportDownload): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoking synchronously can cancel the download in Chromium.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function runExport(make: () => Promise<ExportDownload>): Promise<void> {
  error.value = null
  notice.value = ''
  try {
    const file = await make()
    download(file)
    notice.value = `Export „${file.filename}“ wird heruntergeladen.`
  } catch (e) {
    error.value = toUserError(e, 'Export fehlgeschlagen.')
  }
}

function askConflict(): Promise<ConflictChoice | null> {
  return conflict.ask({
    title: 'Bereits vorhanden',
    message:
      'Die Datei enthält Apps oder Vorlagen, die es hier schon gibt. „Überschreiben“ ersetzt die vorhandenen, „Als Kopie“ legt sie zusätzlich an.',
    choices: [
      { value: 'copy', label: 'Als Kopie', tone: 'secondary' },
      { value: 'overwrite', label: 'Überschreiben', tone: 'danger' },
    ],
  })
}

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so choosing the same file again fires another change event.
  input.value = ''
  if (!file) return
  let text: string
  try {
    text = await file.text()
  } catch (e) {
    error.value = toUserError(e, 'Die Datei konnte nicht gelesen werden.')
    return
  }
  await manage.importFile(text, askConflict)
}

const secondaryButton =
  'rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-text hover:bg-line disabled:opacity-60 focus-visible:focus-ring'
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <header class="border-b border-line">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div>
          <h1 class="font-display text-2xl font-bold tracking-[-0.01em]">
            Vorlagen verwalten
          </h1>
          <p class="text-xs text-muted">
            Form Filler {{ version }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="apps.some((a) => a.source !== undefined)"
            type="button"
            :class="secondaryButton"
            :disabled="busy"
            @click="manage.syncAll()"
          >
            Alle abgleichen
          </button>
          <button
            type="button"
            :class="secondaryButton"
            :disabled="apps.length === 0"
            @click="runExport(manage.exportAll)"
          >
            Alles exportieren
          </button>
          <button
            type="button"
            :class="secondaryButton"
            :disabled="busy"
            aria-describedby="import-hint"
            @click="fileInput?.click()"
          >
            Importieren …
          </button>
          <span
            id="import-hint"
            class="sr-only"
          >Öffnet die Dateiauswahl für eine JSON-Export-Datei.</span>
          <input
            ref="fileInput"
            type="file"
            accept="application/json,.json"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            @change="onFileChosen"
          >
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <!-- Live regions stay mounted so screen readers pick up content changes. -->
      <div role="status">
        <p
          v-if="notice && !error"
          class="mb-4 flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm"
        >
          <span
            aria-hidden="true"
            class="mt-1.5 size-2.5 shrink-0 rounded-full bg-success"
          />
          {{ notice }}
        </p>
      </div>
      <div role="alert">
        <p
          v-if="error"
          class="mb-4 flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm"
        >
          <span
            aria-hidden="true"
            class="mt-1.5 size-2.5 shrink-0 rounded-full bg-error"
          />
          <span>{{ error.message }}<span
            v-if="error.detail"
            class="block text-xs text-muted"
          >{{ error.detail }}</span></span>
        </p>
      </div>

      <p
        v-if="apps.length === 0"
        class="rounded-2xl border border-border-subtle bg-surface p-6 text-sm text-muted"
      >
        Noch keine Apps. Öffne die Seite einer App, klicke auf das Symbol der Erweiterung und lege dort App und Vorlage an – oder importiere eine Export-Datei.
      </p>

      <div
        v-else
        class="grid items-start gap-5 min-[900px]:grid-cols-[17rem_minmax(0,1fr)]"
      >
        <AppList
          :apps="apps"
          :selected-app="selectedApp"
          :templates="templates"
          :selected-template-id="selectedTemplate?.id ?? null"
          :busy="busy"
          :actions="manage"
          @export-app="(id: string) => runExport(() => manage.exportApp(id))"
        />
        <TemplateTable
          v-if="selectedApp && selectedTemplate"
          :key="selectedTemplate.id"
          :app="selectedApp"
          :template="selectedTemplate"
          :busy="busy"
          :actions="manage"
        />
        <p
          v-else
          class="rounded-2xl border border-border-subtle bg-surface p-6 text-sm text-muted"
        >
          Wähle links eine Vorlage aus.
        </p>
      </div>
    </main>

    <ConfirmDialog
      :request="conflict.request.value"
      @choose="conflict.choose"
    />
  </div>
</template>
