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
    class="grid grid-flow-col auto-cols-fr rounded-full border border-border-subtle bg-surface p-[3px]"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      ref="buttons"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :tabindex="option.value === modelValue ? 0 : -1"
      class="rounded-full px-2 py-1.5 text-[13px] font-medium focus-visible:focus-ring"
      :class="option.value === modelValue ? 'bg-brand text-on-brand ring-1 ring-brand-fg ring-inset' : 'text-muted hover:text-text'"
      @click="emit('update:modelValue', option.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
