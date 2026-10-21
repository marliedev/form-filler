<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { browser } from 'wxt/browser'
import AppList from '../../src/manage/AppList.vue'
import TemplateTable from '../../src/manage/TemplateTable.vue'
import { useManage, type ConflictChoice, type ExportDownload } from '../../src/manage/useManage'
import { toUserError } from '../../src/popup/userError'
import ConfirmDialog from '../../src/ui/ConfirmDialog.vue'
import { useDialog } from '../../src/ui/dialog'

const manage = useManage()
const { apps, selectedApp, templates, selectedTemplate, busy, error, notice } = manage
const fileInput = ref<HTMLInputElement | null>(null)
const conflict = useDialog<ConflictChoice>()

// The recorder and fills in other tabs write to storage; mirror that here.
function onStorageChanged(_changes: unknown, area: string): void {
  if (area === 'local') void manage.refresh()
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
  'rounded-md border border-zinc-500 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
</script>

<template>
  <div class="min-h-screen bg-zinc-50 text-zinc-900">
    <header class="border-b border-zinc-200 bg-white">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <h1 class="text-lg font-semibold">
          Vorlagen verwalten
        </h1>
        <div class="flex flex-wrap gap-2">
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
          class="mb-4 rounded-md border border-green-700 bg-green-50 px-3 py-2 text-sm text-green-900"
        >
          {{ notice }}
        </p>
      </div>
      <div role="alert">
        <p
          v-if="error"
          class="mb-4 rounded-md border border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {{ error.message }}<span
            v-if="error.detail"
            class="block text-xs text-red-800"
          >{{ error.detail }}</span>
        </p>
      </div>

      <p
        v-if="apps.length === 0"
        class="rounded-xl border border-zinc-300 bg-white p-6 text-sm text-zinc-700"
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
          class="rounded-xl border border-zinc-300 bg-white p-6 text-sm text-zinc-700"
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
