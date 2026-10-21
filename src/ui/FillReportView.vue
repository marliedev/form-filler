<script setup lang="ts">
import { computed } from 'vue'
import { isProblem, STATUS_TEXT } from '../fill/reportSummary'
import type { FieldReport, FillReport } from '../fill/runFill'

const props = defineProps<{ report: FillReport }>()

// Problems first: they are what the user opened the report for.
const rows = computed(() => {
  const rank = (f: FieldReport): number => (isProblem(f.status) ? 0 : f.status === 'filled' ? 1 : 2)
  return [...props.report.fields].sort((a, b) => rank(a) - rank(b))
})

function icon(status: FieldReport['status']): string {
  return isProblem(status) ? '⚠' : status === 'filled' ? '✓' : '–'
}

function tone(status: FieldReport['status']): string {
  return isProblem(status) ? 'text-amber-800' : status === 'filled' ? 'text-green-700' : 'text-zinc-600'
}
</script>

<template>
  <ul
    class="max-h-48 divide-y divide-zinc-200 overflow-y-auto rounded-lg border border-zinc-200"
    aria-label="Feld-Protokoll"
  >
    <li
      v-for="field in rows"
      :key="field.fieldId"
      class="flex items-start justify-between gap-3 px-2.5 py-1.5"
    >
      <span class="min-w-0 break-words">{{ field.label }}<span class="sr-only">: </span></span>
      <span
        class="shrink-0 text-right"
        :class="tone(field.status)"
      >
        <span aria-hidden="true">{{ icon(field.status) }}</span>
        {{ STATUS_TEXT[field.status] }}
        <span
          v-if="field.detail && field.status !== 'filled'"
          class="block text-xs text-zinc-600"
        >{{ field.detail }}</span>
      </span>
    </li>
  </ul>
</template>
