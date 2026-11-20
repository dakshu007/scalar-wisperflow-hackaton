import { useSyncExternalStore } from 'react'
import type { State } from './types'
import { seedState } from './seed'

const KEY = 'gharbolo:v1'
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('gharbolo') : null

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as State
      const seeded = seedState()
      return { ...seeded, ...s, settings: { ...seeded.settings, ...s.settings } }
    }
  } catch {
    /* fall through to seed */
  }
  return seedState()
}

let state: State = load()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage full (audio clips) — drop the oldest audio and retry once.
    const withAudio = state.messages.filter((m) => m.audio)
    if (withAudio.length) {
      const oldest = withAudio[0].id
      state = { ...state, messages: state.messages.map((m) => (m.id === oldest ? { ...m, audio: undefined } : m)) }
      try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* give up quietly */ }
    }
  }
}

export function setState(fn: (s: State) => State) {
  state = fn(state)
  persist()
  emit()
  channel?.postMessage('sync')
}

export function getState() {
  return state
}

export function resetState() {
  state = seedState()
  persist()
  emit()
  channel?.postMessage('sync')
}

// Keep every open tab / iframe (employer + helper phones) in sync.
const reload = () => {
  state = load()
  emit()
}
channel?.addEventListener('message', reload)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) reload()
  })
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
