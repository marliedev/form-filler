<script setup lang="ts" generic="V extends string">
import { nextTick, ref, useId, watch } from 'vue'
import type { DialogChoice, DialogRequest } from './dialog'

defineOptions({ name: 'ConfirmDialog' })

const props = defineProps<{
  /** Open while non-null. */
  request: DialogRequest<V> | null
}>()

const emit = defineEmits<{
  /** null when dismissed (Abbrechen, Esc). */
  choose: [value: V | null]
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const titleId = useId()
const messageId = useId()
let opener: HTMLElement | null = null

watch(
  () => props.request !== null,
  async (open) => {
    const el = dialog.value
    if (!el) return
    if (open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!el.open) el.showModal()
      // The safe option gets focus so an accidental Enter does not delete anything.
      await nextTick()
      cancelButton.value?.focus()
    } else if (el.open) {
      el.close()
      if (opener?.isConnected) opener.focus()
      opener = null
    }
  },
  { flush: 'post' },
)

function onCancel(event: Event): void {
  event.preventDefault()
  emit('choose', null)
}

const toneClass: Record<DialogChoice<V>['tone'], string> = {
  danger: 'bg-red-700 text-white hover:bg-red-800',
  primary: 'bg-blue-700 text-white hover:bg-blue-800',
  secondary: 'border border-zinc-500 text-zinc-900 hover:bg-zinc-100',
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    :aria-describedby="messageId"
    class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-900 shadow-xl backdrop:bg-zinc-900/40"
    @cancel="onCancel"
  >
    <h2
      :id="titleId"
      class="text-base font-semibold"
    >
      {{ request?.title }}
    </h2>
    <p
      :id="messageId"
      class="mt-2 text-zinc-700"
    >
      {{ request?.message }}
    </p>
    <div class="mt-5 flex flex-wrap justify-end gap-2">
      <button
        ref="cancelButton"
        type="button"
        class="rounded-md border border-zinc-500 px-3 py-1.5 font-medium text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        @click="emit('choose', null)"
      >
        Abbrechen
      </button>
      <button
        v-for="choice in request?.choices ?? []"
        :key="choice.value"
        type="button"
        class="rounded-md px-3 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        :class="toneClass[choice.tone]"
        @click="emit('choose', choice.value)"
      >
        {{ choice.label }}
      </button>
    </div>
  </dialog>
</template>
