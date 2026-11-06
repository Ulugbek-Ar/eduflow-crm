// Amallar jurnali: kim, qachon, nima qildi. Faqat qo'shiladi (tahrirlab ham, o'chirib ham bo'lmaydi).
// Lokal rejimda apex:audit (demo rejimda alohida); Supabase rejimida audit_log jadvali (faqat INSERT)
import { tr } from '../i18n'
import type { Role } from '../types/user.types'
import { createId } from '../utils/format'
import { isIsoDate, isRecord, isText, keepValid, oneOf } from '../utils/guards'
import { physicalKey, readJson, setItem } from './storage.service'

export const AUDIT_KEY = 'apex:audit'
// Brauzer xotirasini to'ldirmaslik uchun: oxirgi 3000 ta yozuv yoki 1 yil
export const MAX_AUDIT_ENTRIES = 3000
export const AUDIT_RETENTION_MS = 365 * 86_400_000

export type AuditAction =
  | 'customer.create'
  | 'customer.update'
  | 'customer.status'
  | 'customer.delete'
  | 'customer.restore'
  | 'payment.create'
  | 'payment.update'
  | 'payment.status'
  | 'payment.delete'
  | 'payment.restore'
  | 'course.create'
  | 'course.update'
  | 'course.archive'
  | 'course.delete'
  | 'course.restore'
  | 'settings.update'
  | 'data.export'
  | 'data.backup'
  | 'data.import'
  | 'data.reset'
  | 'data.clear'
  | 'trash.purge'
  | 'staff.create'
  | 'staff.update'
  | 'staff.block'
  | 'staff.unblock'
  | 'staff.password'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'auth.password'
  | 'session.revoke'

export type AuditCategory = 'customers' | 'payments' | 'courses' | 'staff' | 'auth' | 'data'

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  customers: tr('Mijozlar'),
  payments: tr('To\'lovlar'),
  courses: tr('Kurslar'),
  staff: tr('Xodimlar'),
  auth: tr('Kirish va seanslar'),
  data: tr('Sozlamalar va ma\'lumot'),
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'customer.create': tr('Mijoz qo\'shildi'),
  'customer.update': tr('Mijoz tahrirlandi'),
  'customer.status': tr('Bosqich o\'zgardi'),
  'customer.delete': tr('Mijoz o\'chirildi'),
  'customer.restore': tr('Mijoz tiklandi'),
  'payment.create': tr('To\'lov / xarajat yozildi'),
  'payment.update': tr('Tranzaksiya tahrirlandi'),
  'payment.status': tr('To\'lov statusi o\'zgardi'),
  'payment.delete': tr('Tranzaksiya o\'chirildi'),
  'payment.restore': tr('Tranzaksiya tiklandi'),
  'course.create': tr('Kurs qo\'shildi'),
  'course.update': tr('Kurs tahrirlandi'),
  'course.archive': tr('Kurs arxivlandi'),
  'course.delete': tr('Kurs o\'chirildi'),
  'course.restore': tr('Kurs tiklandi'),
  'settings.update': tr('Sozlamalar o\'zgardi'),
  'data.export': tr('Hisobot yuklab olindi'),
  'data.backup': tr('Zaxira olindi'),
  'data.import': tr('Zaxiradan tiklandi'),
  'data.reset': tr('Demo ma\'lumot yuklandi'),
  'data.clear': tr('Ma\'lumot tozalandi'),
  'trash.purge': tr('Savatchadan butunlay o\'chirildi'),
  'staff.create': tr('Xodim qo\'shildi'),
  'staff.update': tr('Xodim tahrirlandi'),
  'staff.block': tr('Xodim bloklandi'),
  'staff.unblock': tr('Xodim blokdan chiqarildi'),
  'staff.password': tr('Xodim paroli tiklandi'),
  'auth.login': tr('Tizimga kirdi'),
  'auth.logout': tr('Tizimdan chiqdi'),
  'auth.failed': tr('Noto\'g\'ri kirish urinishi'),
  'auth.password': tr('O\'z paroli yoki logini o\'zgardi'),
  'session.revoke': tr('Seans yopildi'),
}

const ACTIONS = AUDIT_ACTION_LABELS as Record<AuditAction, unknown>
const ROLES: Record<Role, true> = { admin: true, manager: true, cashier: true, viewer: true }

export function actionCategory(action: AuditAction): AuditCategory {
  const prefix = action.split('.')[0]
  if (prefix === 'customer') return 'customers'
  if (prefix === 'payment') return 'payments'
  if (prefix === 'course') return 'courses'
  if (prefix === 'staff') return 'staff'
  if (prefix === 'auth' || prefix === 'session') return 'auth'
  return 'data'
}

export interface AuditActor {
  userId: string
  userName: string
  role: Role
}

export interface AuditEntry {
  id: string
  at: string
  action: AuditAction
  // Kim: o'chirilgan xodim ham jurnalda ismi bilan qoladi (snapshot)
  userId: string
  userName: string
  role?: Role
  // Nima haqida: "Aziza Karimova", "650 000 so'm" kabi qisqa tavsif
  summary: string
  entityId?: string
}

export function isAuditEntry(value: unknown): value is AuditEntry {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isIsoDate(value.at) &&
    oneOf(ACTIONS, value.action) &&
    typeof value.userId === 'string' &&
    typeof value.userName === 'string' &&
    (value.role === undefined || oneOf(ROLES, value.role)) &&
    typeof value.summary === 'string' &&
    (value.entityId === undefined || typeof value.entityId === 'string')
  )
}

function prune(entries: readonly AuditEntry[], now = Date.now()): AuditEntry[] {
  return entries.filter((e) => now - Date.parse(e.at) < AUDIT_RETENTION_MS).slice(0, MAX_AUDIT_ENTRIES)
}

// Eng yangisi birinchi
export function readAudit(now = Date.now()): AuditEntry[] {
  const raw = readJson(AUDIT_KEY)
  return Array.isArray(raw) ? prune(keepValid(raw, isAuditEntry), now) : []
}

// ===== useSyncExternalStore uchun: yozilganda yoki boshqa tabda o'zgarganda yangilanadi =====
const listeners = new Set<() => void>()
let snapshot: AuditEntry[] | null = null

function notify(): void {
  snapshot = null
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === physicalKey(AUDIT_KEY)) notify()
}

export function subscribeAudit(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    // Birinchi obunachi: kesh eskirgan bo'lishi mumkin (masalan, rejim almashgan)
    snapshot = null
    window.addEventListener('storage', onStorage)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

export function getAuditSnapshot(): AuditEntry[] {
  snapshot ??= readAudit()
  return snapshot
}

// Nom maydoni (demo/haqiqiy) almashganda kesh yangilanadi
export function resetAuditCache(): void {
  notify()
}

export function logAudit(actor: AuditActor | null, action: AuditAction, summary: string, entityId?: string, now = new Date()): AuditEntry {
  const entry: AuditEntry = {
    id: createId('a'),
    at: now.toISOString(),
    action,
    userId: actor?.userId ?? '',
    userName: actor?.userName ?? 'Noma\'lum',
    ...(actor ? { role: actor.role } : {}),
    summary: summary.slice(0, 200),
    ...(entityId ? { entityId } : {}),
  }
  // Jurnal yozilmasa ham asosiy amal to'xtamaydi (xotira to'lgan bo'lsa saqlash xatosi boshqa joyda ko'rsatiladi)
  setItem(AUDIT_KEY, prune([entry, ...readAudit(now.getTime())], now.getTime()))
  notify()
  return entry
}

export interface AuditFilters {
  query: string
  userId: string
  category: AuditCategory | 'all'
  // 'YYYY-MM-DD' yoki ''
  from: string
  to: string
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = { query: '', userId: 'all', category: 'all', from: '', to: '' }

function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function filterAudit(entries: readonly AuditEntry[], filters: AuditFilters): AuditEntry[] {
  const query = filters.query.trim().toLowerCase()
  return entries.filter((e) => {
    if (filters.userId !== 'all' && e.userId !== filters.userId) return false
    if (filters.category !== 'all' && actionCategory(e.action) !== filters.category) return false
    const day = localDay(e.at)
    if (filters.from && day < filters.from) return false
    if (filters.to && day > filters.to) return false
    if (query && !`${e.summary} ${e.userName} ${AUDIT_ACTION_LABELS[e.action]}`.toLowerCase().includes(query)) return false
    return true
  })
}
