import { reactive, readonly } from 'vue'

export type ToastSeverity = 'info' | 'warn' | 'error' | 'success'

export interface ToastMessage {
  id: number
  severity: ToastSeverity
  summary: string
  detail?: string
  life?: number
}

let nextId = 1

const state = reactive<{ messages: ToastMessage[] }>({
  messages: [],
})

function add(msg: Omit<ToastMessage, 'id'>) {
  const id = nextId++
  const life = msg.life ?? 4000
  state.messages.push({ ...msg, id, life })
  setTimeout(() => remove(id), life)
}

function remove(id: number) {
  const idx = state.messages.findIndex((m) => m.id === id)
  if (idx !== -1) state.messages.splice(idx, 1)
}

export function useToast() {
  return {
    messages: readonly(state.messages),
    add,
    remove,
  }
}
