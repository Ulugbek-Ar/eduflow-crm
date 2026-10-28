import { useEffect, useState } from 'react'
import { readJson, setItem } from '../services/storage.service'
import { isRecord } from '../utils/guards'
import type { AppNotification } from '../utils/notifications'

const KEY = 'apex:notifications'

interface NotificationState {
  read: string[]
  dismissed: string[]
}

function loadState(): NotificationState {
  const raw = readJson(KEY)
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
  return isRecord(raw) ? { read: list(raw.read), dismissed: list(raw.dismissed) } : { read: [], dismissed: [] }
}

// Eslatmalar har safar ma'lumotdan hisoblanadi; faqat "o'qildi" va "tozalandi" holati saqlanadi
export function useNotifications(all: AppNotification[]) {
  const [state, setState] = useState(loadState)

  useEffect(() => setItem(KEY, state), [state])

  const visible = all.filter((n) => !state.dismissed.includes(n.id))
  const unread = visible.filter((n) => !state.read.includes(n.id)).length
  const currentIds = all.map((n) => n.id)

  // Eskirgan id'lar saqlanib qolmasligi uchun faqat joriy eslatmalar qoldiriladi
  const prune = (ids: string[]) => ids.filter((id) => currentIds.includes(id))

  return {
    items: visible.map((n) => ({ ...n, read: state.read.includes(n.id) })),
    unread,
    markRead: (id: string) => setState((s) => ({ ...s, read: prune([...s.read, id]) })),
    markAllRead: () => setState((s) => ({ ...s, read: prune([...s.read, ...currentIds]) })),
    clearAll: () => setState((s) => ({ read: prune(s.read), dismissed: prune([...s.dismissed, ...currentIds]) })),
  }
}
