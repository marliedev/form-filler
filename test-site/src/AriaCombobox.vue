<script setup lang="ts">
import { computed, ref, useId } from 'vue'

export interface ComboOption {
  value: string
  label: string
  disabled?: boolean
}

const props = defineProps<{ label: string; options: ComboOption[]; name: string }>()
const model = defineModel<string>({ default: '' })

const uid = useId()
const labelId = `${uid}-label`
const listId = `${uid}-list`
const open = ref(false)
const active = ref(-1)

const selected = computed(() => props.options.find((o) => o.value === model.value))
const optionId = (i: number) => `${uid}-opt-${i}`

function choose(o: ComboOption): void {
  if (o.disabled) return
  model.value = o.value
  open.value = false
}

function move(step: number): void {
  if (!open.value) {
    open.value = true
    active.value = Math.max(0, props.options.findIndex((o) => o.value === model.value))
    return
  }
  const n = props.options.length
  active.value = (active.value + step + n) % n
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') move(1)
  else if (e.key === 'ArrowUp') move(-1)
  else if (e.key === 'Escape') open.value = false
  else if ((e.key === 'Enter' || e.key === ' ') && open.value) {
    const o = props.options[active.value]
    if (o) choose(o)
  } else return
  e.preventDefault()
}
</script>

<template>
  <div class="field">
    <span :id="labelId">{{ label }}</span>
    <div
      role="combobox"
      tabindex="0"
      class="combo"
      :data-name="name"
      :aria-labelledby="labelId"
      :aria-controls="listId"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-activedescendant="open && active >= 0 ? optionId(active) : undefined"
      @click="open = !open"
      @keydown="onKeydown"
      @blur="open = false"
    >
      {{ selected?.label ?? 'Bitte wählen' }}
    </div>
    <ul
      v-show="open"
      :id="listId"
      role="listbox"
      :aria-labelledby="labelId"
      class="list"
    >
      <!-- Selection on mousedown (prevented) keeps focus on the combobox, as in the APG example. -->
      <li
        v-for="(o, i) in options"
        :id="optionId(i)"
        :key="o.value"
        role="option"
        :data-value="o.value"
        :aria-selected="o.value === model"
        :aria-disabled="o.disabled ? 'true' : undefined"
        :class="{ active: i === active }"
        @mousedown.prevent="choose(o)"
      >
        {{ o.label }}
      </li>
    </ul>
  </div>
</template>
