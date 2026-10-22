<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { AppDef, Template } from '../model/types'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import { useDialog } from '../ui/dialog'
import { TEMPLATES_HEADING_ID } from './ids'
import { count, type ManageState } from './useManage'

defineOptions({ name: 'AppList' })

const props = defineProps<{
  apps: AppDef[]
  selectedApp: AppDef | null
  templates: Template[]
  selectedTemplateId: string | null
  busy: boolean
  actions: Pick<ManageState, 'selectApp' | 'selectTemplate' | 'saveApp' | 'removeApp'>
}>()

const emit = defineEmits<{ 'export-app': [id: string] }>()

const uid = useId()
const appsHeading = ref<HTMLElement | null>(null)
const confirm = useDialog<'delete'>()

const form = ref({ name: '', patterns: '' })

// Compared by value: every storage refresh hands in a new app object, which must not wipe typing.
watch(
  () => JSON.stringify(props.selectedApp),
  () => {
    const app = props.selectedApp
    form.value = { name: app?.name ?? '', patterns: app?.urlPatterns.join('\n') ?? '' }
  },
  { immediate: true },
)

function patternsOf(text: string): string[] {
  return text.split('\n').map((p) => p.trim()).filter((p) => p !== '')
}

const dirty = computed(() => {
  const app = props.selectedApp
  if (app === null) return false
  return form.value.name.trim() !== app.name || patternsOf(form.value.patterns).join('\n') !== app.urlPatterns.join('\n')
})

function save(): void {
  const app = props.selectedApp
  if (app === null) return
  // No await before saveApp: it requests host permissions, which needs the click's user gesture.
  void props.actions.saveApp({ id: app.id, name: form.value.name, urlPatterns: patternsOf(form.value.patterns) })
}

async function remove(): Promise<void> {
  const app = props.selectedApp
  if (app === null) return
  const choice = await confirm.ask({
    title: 'App löschen?',
    message:
      props.templates.length === 0
        ? `Die App „${app.name}“ wird endgültig gelöscht.`
        : `Die App „${app.name}“ und ihre ${count(props.templates.length, 'Vorlage', 'Vorlagen')} werden endgültig gelöscht.`,
    choices: [{ value: 'delete', label: 'App löschen', tone: 'danger' }],
  })
  if (choice !== 'delete') return
  if (await props.actions.removeApp(app.id)) void nextTick(() => appsHeading.value?.focus())
}

function processText(t: Template): string {
  return t.process ? `${t.process.name}, Schritt ${t.process.step}` : ''
}

const itemClass =
  'flex w-full flex-col items-start rounded-xl px-3 py-2 text-left text-sm focus-visible:focus-ring'
const control =
  'mt-1 block w-full rounded-sm border border-muted bg-surface px-2 py-1.5 text-sm text-text focus-visible:focus-ring'
const labelClass = 'block text-xs font-medium text-muted'
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-2xl border border-border-subtle bg-surface p-3">
      <h2
        :id="`${uid}-apps`"
        ref="appsHeading"
        tabindex="-1"
        class="rounded-sm px-1 pb-2 font-display text-base font-semibold focus-visible:focus-ring"
      >
        Apps
      </h2>
      <ul class="space-y-1">
        <li
          v-for="app in apps"
          :key="app.id"
        >
          <button
            type="button"
            :class="[itemClass, app.id === selectedApp?.id ? 'bg-brand text-on-brand ring-1 ring-brand-fg ring-inset' : 'text-text hover:bg-line']"
            :aria-current="app.id === selectedApp?.id ? 'true' : undefined"
            @click="actions.selectApp(app.id)"
          >
            <span class="font-medium">{{ app.name }}</span>
            <span
              class="max-w-full truncate text-xs"
              :class="app.id === selectedApp?.id ? 'text-brand-fg-strong' : 'text-muted'"
            >{{ app.urlPatterns.join(', ') }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section
      v-if="selectedApp"
      :aria-labelledby="TEMPLATES_HEADING_ID"
      class="rounded-2xl border border-border-subtle bg-surface p-3"
    >
      <h2
        :id="TEMPLATES_HEADING_ID"
        tabindex="-1"
        class="rounded-sm px-1 pb-2 font-display text-base font-semibold focus-visible:focus-ring"
      >
        Vorlagen von {{ selectedApp.name }}
      </h2>
      <p
        v-if="templates.length === 0"
        class="px-1 text-sm text-muted"
      >
        Noch keine Vorlagen. Lege sie im Popup auf der Seite der App an.
      </p>
      <ul
        v-else
        class="space-y-1"
      >
        <li
          v-for="t in templates"
          :key="t.id"
        >
          <button
            type="button"
            :class="[itemClass, t.id === selectedTemplateId ? 'bg-bg text-text ring-1 ring-brand-fg ring-inset' : 'text-text hover:bg-line']"
            :aria-current="t.id === selectedTemplateId ? 'true' : undefined"
            @click="actions.selectTemplate(t.id)"
          >
            <span class="font-medium">{{ t.name }}</span>
            <span class="text-xs text-muted">
              {{ t.fields.length }} {{ t.fields.length === 1 ? 'Feld' : 'Felder' }}<template v-if="processText(t)"> · {{ processText(t) }}</template>
            </span>
            <span
              v-if="t.lastMissing.length > 0"
              class="text-xs font-medium text-warning"
            ><span aria-hidden="true">⚠ </span>{{ t.lastMissing.length }} zuletzt nicht gefunden</span>
          </button>
        </li>
      </ul>
    </section>

    <section
      v-if="selectedApp"
      :aria-labelledby="`${uid}-settings`"
      class="rounded-2xl border border-border-subtle bg-surface p-3"
    >
      <h2
        :id="`${uid}-settings`"
        class="px-1 pb-2 font-display text-base font-semibold"
      >
        App-Einstellungen
      </h2>
      <form
        class="space-y-3 px-1"
        novalidate
        @submit.prevent="save"
      >
        <div>
          <label
            :for="`${uid}-name`"
            :class="labelClass"
          >Name</label>
          <input
            :id="`${uid}-name`"
            v-model="form.name"
            type="text"
            required
            :class="control"
          >
        </div>
        <div>
          <label
            :for="`${uid}-patterns`"
            :class="labelClass"
          >URL-Muster (eins pro Zeile)</label>
          <textarea
            :id="`${uid}-patterns`"
            v-model="form.patterns"
            rows="3"
            required
            :aria-describedby="`${uid}-patterns-hint`"
            :class="[control, 'font-mono text-xs']"
          />
          <p
            :id="`${uid}-patterns-hint`"
            class="mt-1 text-xs text-muted"
          >
            * steht für beliebige Zeichen, z. B. https://app.example.com/*
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            :disabled="!dirty || busy"
            class="rounded-sm bg-brand px-3 py-1.5 text-sm font-medium text-on-brand hover:brightness-125 disabled:opacity-60 disabled:hover:brightness-100 focus-visible:focus-ring"
          >
            Speichern
          </button>
          <button
            type="button"
            class="rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-text hover:bg-line disabled:opacity-60 focus-visible:focus-ring"
            @click="emit('export-app', selectedApp.id)"
          >
            Exportieren
          </button>
          <button
            type="button"
            class="rounded-sm px-3 py-1.5 text-sm font-medium text-text underline underline-offset-3 hover:bg-line focus-visible:focus-ring"
            @click="remove"
          >
            App löschen
          </button>
        </div>
      </form>
    </section>

    <ConfirmDialog
      :request="confirm.request.value"
      @choose="confirm.choose"
    />
  </div>
</template>
