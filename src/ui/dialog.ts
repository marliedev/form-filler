import { shallowRef, type ShallowRef } from 'vue'

export interface DialogChoice<V extends string> {
  value: V
  label: string
  tone: 'danger' | 'primary' | 'secondary'
}

export interface DialogRequest<V extends string> {
  title: string
  message: string
  choices: DialogChoice<V>[]
}

export interface Dialog<V extends string> {
  /** The open request, null while closed; bind to `ConfirmDialog`. */
  request: ShallowRef<DialogRequest<V> | null>
  /** Opens the dialog; resolves to the chosen value or null when dismissed. */
  ask(request: DialogRequest<V>): Promise<V | null>
  choose(value: V | null): void
}

export function useDialog<V extends string>(): Dialog<V> {
  const request = shallowRef<DialogRequest<V> | null>(null)
  let resolve: ((value: V | null) => void) | null = null

  function ask(next: DialogRequest<V>): Promise<V | null> {
    resolve?.(null)
    request.value = next
    return new Promise((r) => {
      resolve = r
    })
  }

  function choose(value: V | null): void {
    request.value = null
    const done = resolve
    resolve = null
    done?.(value)
  }

  return { request, ask, choose }
}
