<script setup lang="ts" generic="T extends string">
import { ref } from 'vue'
import type { SegmentedOption } from './segmented'

defineOptions({ name: 'SegmentedControl' })

const props = defineProps<{
  modelValue: T
  options: SegmentedOption<T>[]
  label: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const buttons = ref<HTMLButtonElement[]>([])

// Radio group pattern: arrows move focus and selection together, Tab leaves the group.
function onKeydown(event: KeyboardEvent, index: number): void {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (step === 0) return
  event.preventDefault()
  const count = props.options.length
  const next = (index + step + count) % count
  const option = props.options[next]
  if (!option) return
  emit('update:modelValue', option.value)
  buttons.value[next]?.focus()
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="grid grid-flow-col auto-cols-fr rounded-lg border border-zinc-500 p-0.5"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      ref="buttons"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :tabindex="option.value === modelValue ? 0 : -1"
      class="rounded-md px-2 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
      :class="option.value === modelValue ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'"
      @click="emit('update:modelValue', option.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
