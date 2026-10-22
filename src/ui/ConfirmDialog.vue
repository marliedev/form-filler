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
  danger: 'bg-error text-on-status hover:brightness-110',
  primary: 'bg-brand text-on-brand hover:brightness-125',
  secondary: 'border border-line text-text hover:bg-line',
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    :aria-describedby="messageId"
    class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-sm text-text shadow-xl backdrop:bg-bg/70"
    @cancel="onCancel"
  >
    <h2
      :id="titleId"
      class="font-display text-lg font-semibold"
    >
      {{ request?.title }}
    </h2>
    <p
      :id="messageId"
      class="mt-2 text-muted"
    >
      {{ request?.message }}
    </p>
    <div class="mt-5 flex flex-wrap justify-end gap-2">
      <button
        ref="cancelButton"
        type="button"
        class="rounded-sm border border-line px-3 py-1.5 font-medium text-text hover:bg-line focus-visible:focus-ring"
        @click="emit('choose', null)"
      >
        Abbrechen
      </button>
      <button
        v-for="choice in request?.choices ?? []"
        :key="choice.value"
        type="button"
        class="rounded-sm px-3 py-1.5 font-medium focus-visible:focus-ring"
        :class="toneClass[choice.tone]"
        @click="emit('choose', choice.value)"
      >
        {{ choice.label }}
      </button>
    </div>
  </dialog>
</template>
