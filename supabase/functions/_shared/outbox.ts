// Xabarlar navbati (notification_outbox) — sof mantiq (Deno va Vitest'da bir xil). Cron har 5 daqiqada chaqiradi:
// dars qoldirildi / to'lov qabul qilindi xabarlarini ota-onaning Telegram chatlariga, o'zi tanlagan tilda yuboradi.
import { notificationText } from './telegram.ts'
import type { Lang, TelegramResult } from './telegram.ts'

export const OUTBOX_MAX_ATTEMPTS = 3
// O'qituvchi xato belgilagan "Kelmadi"ni tuzatishga ulgursin
export const OUTBOX_GRACE_MS = 2 * 60_000
// Cron uzoq to'xtab qolsa eski voqealar ota-onaga yuborilmaydi
export const OUTBOX_STALE_MS = 3 * 86_400_000

export interface OutboxItem {
  id: number
  customerId: string
  kind: 'absence' | 'payment'
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
}

export interface OutboxContext {
  now: number
  // Toshkent bo'yicha bugun (YYYY-MM-DD): "bugun darsga kelmadi"
  today: string
  currency: string
  enabled: { absence: boolean; payment: boolean }
  // O'chirilmagan o'quvchilar: id -> ism
  customers: ReadonlyMap<string, string>
  groups: ReadonlyMap<string, string>
  chats: ReadonlyMap<string, ReadonlyArray<{ chatId: number; lang: Lang }>>
  // Voqea hali ham to'g'rimi: "Kelmadi" o'zgartirilmagan, to'lov bekor qilinmagan
  stillValid: (item: OutboxItem) => boolean
  send: (chatId: number, text: string, lang: Lang) => Promise<TelegramResult | null>
  // Ota-ona botni bloklagan (403) — bog'lanish o'chiriladi
  unlink: (customerId: string, chatId: number) => Promise<void>
}

// done: navbatdan chiqadi (sent_at qo'yiladi); aks holda attempts + 1 va keyingi safar qayta urinadi
export interface OutboxOutcome {
  id: number
  done: boolean
  delivered: number
  error: string | null
}

export function isOutboxItem(value: unknown): value is OutboxItem {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'number' &&
    typeof v.customerId === 'string' &&
    (v.kind === 'absence' || v.kind === 'payment') &&
    typeof v.payload === 'object' &&
    v.payload !== null &&
    typeof v.createdAt === 'string' &&
    typeof v.attempts === 'number'
  )
}

export async function deliverOutbox(items: readonly OutboxItem[], ctx: OutboxContext): Promise<OutboxOutcome[]> {
  const outcomes: OutboxOutcome[] = []
  const skip = (item: OutboxItem, error: string) => outcomes.push({ id: item.id, done: true, delivered: 0, error })
  for (const item of items) {
    const created = Date.parse(item.createdAt)
    if (!Number.isFinite(created) || ctx.now - created > OUTBOX_STALE_MS) {
      skip(item, 'stale')
      continue
    }
    if (!ctx.enabled[item.kind]) {
      skip(item, 'disabled')
      continue
    }
    const name = ctx.customers.get(item.customerId)
    if (!name) {
      skip(item, 'customer')
      continue
    }
    if (!ctx.stillValid(item)) {
      skip(item, 'cancelled')
      continue
    }
    const chats = ctx.chats.get(item.customerId) ?? []
    if (chats.length === 0) {
      skip(item, 'not-linked')
      continue
    }
    const groupName = ctx.groups.get(String(item.payload.group_id ?? '')) ?? ''
    let delivered = 0
    let failure = ''
    for (const chat of chats) {
      const text = notificationText({ kind: item.kind, payload: item.payload }, { name, groupName, currency: ctx.currency, today: ctx.today }, chat.lang)
      const result = await ctx.send(chat.chatId, text, chat.lang).catch(() => null)
      if (result?.ok) delivered += 1
      else if (result?.status === 403) await ctx.unlink(item.customerId, chat.chatId)
      else failure = (result?.description || 'network').slice(0, 300)
    }
    // Hech bo'lmasa bittasiga yetdi yoki qolganlari botni bloklagan — tayyor; tarmoq xatosi — qayta urinish (3 martagacha)
    if (delivered > 0 || !failure) outcomes.push({ id: item.id, done: true, delivered, error: delivered > 0 ? null : 'blocked' })
    else outcomes.push({ id: item.id, done: item.attempts + 1 >= OUTBOX_MAX_ATTEMPTS, delivered: 0, error: failure })
  }
  return outcomes
}
