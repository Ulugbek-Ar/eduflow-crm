// Savatcha: o'chirilgan mijoz, tranzaksiya va kurs 30 kun saqlanadi, keyin avtomatik yo'qoladi.
// Lokal rejimda apex:trash (demo rejimda alohida); Supabase rejimida deleted_at ustuni (soft delete)
import { tr } from '../i18n'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { isCourse, isCustomer, isIsoDate, isRecord, isText, isTransaction, keepValid } from '../utils/guards'
import { readJson, setItem } from './storage.service'
import type { SaveResult } from './storage.service'

export const TRASH_KEY = 'apex:trash'
export const TRASH_RETENTION_DAYS = 30
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 86_400_000

export type TrashKind = 'customer' | 'transaction' | 'course'

export const TRASH_KIND_LABELS: Record<TrashKind, string> = {
  customer: tr('Mijoz'),
  transaction: tr('Tranzaksiya'),
  course: tr('Kurs'),
}

interface TrashBase {
  // Asl yozuv id'si (tiklashda shu id qaytadi)
  id: string
  deletedAt: string
  deletedBy: string
}

export type TrashEntry =
  | (TrashBase & { kind: 'customer'; item: Customer })
  | (TrashBase & { kind: 'transaction'; item: Transaction })
  | (TrashBase & { kind: 'course'; item: Course })

export function isTrashEntry(value: unknown): value is TrashEntry {
  if (!isRecord(value) || !isText(value.id) || !isIsoDate(value.deletedAt) || typeof value.deletedBy !== 'string') return false
  if (value.kind === 'customer') return isCustomer(value.item)
  if (value.kind === 'transaction') return isTransaction(value.item)
  if (value.kind === 'course') return isCourse(value.item)
  return false
}

// 30 kundan eski yozuvlar tashlab yuboriladi
export function pruneTrash(entries: readonly TrashEntry[], now = Date.now()): TrashEntry[] {
  return entries.filter((e) => now - Date.parse(e.deletedAt) < TRASH_RETENTION_MS)
}

export function loadTrash(now = Date.now()): TrashEntry[] {
  const raw = readJson(TRASH_KEY)
  return Array.isArray(raw) ? pruneTrash(keepValid(raw, isTrashEntry), now) : []
}

export function saveTrash(entries: readonly TrashEntry[]): SaveResult {
  return setItem(TRASH_KEY, entries)
}

// Avtomatik o'chishiga qolgan kunlar (kamida 1 — bugun o'chadigan ham "1 kun" deb ko'rsatiladi)
export function daysLeft(entry: Pick<TrashEntry, 'deletedAt'>, now = Date.now()): number {
  const left = TRASH_RETENTION_MS - (now - Date.parse(entry.deletedAt))
  return Math.max(1, Math.ceil(left / 86_400_000))
}

export function trashTitle(entry: TrashEntry, money: (amount: number) => string): string {
  switch (entry.kind) {
    case 'customer':
      return entry.item.name
    case 'course':
      return entry.item.name
    case 'transaction':
      return `${entry.item.type === 'income' ? 'Kirim' : 'Chiqim'}: ${money(entry.item.amount)}${entry.item.customerName ? ` · ${entry.item.customerName}` : ''}`
  }
}
