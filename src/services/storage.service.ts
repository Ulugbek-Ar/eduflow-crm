import { createMockCustomers, createMockTransactions, DEFAULT_SETTINGS } from '../constants/mockData'
import type { Customer } from '../types/customer.types'
import type { Settings } from '../types/dashboard.types'
import type { Transaction, TransactionCategory, TransactionType } from '../types/finance.types'
import { isCustomer, isRecord, isTransaction, keepValid, sanitizeSettings } from '../utils/guards'

export const STORAGE_KEYS = {
  customers: 'apex:customers',
  transactions: 'apex:transactions',
  settings: 'apex:settings',
  seeded: 'apex:seeded',
  version: 'apex:version',
  // Demo ma'lumot bilan boshlangan (Header'da belgi va tozalash tugmasi ko'rinadi)
  demo: 'apex:demo',
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

// v1 — MVP; v2 — category, ixtiyoriy mijoz maydonlari, kengaytirilgan sozlamalar
export const SCHEMA_VERSION = 2

export interface StoredData {
  customers: Customer[]
  transactions: Transaction[]
  settings: Settings
}

export interface LoadResult {
  data: StoredData
  // Tekshiruvdan o'tmay tashlab yuborilgan yozuvlar soni
  dropped: number
  // Yuklashda qayta saqlash (migratsiya) muvaffaqiyatsiz bo'lsa
  saveError?: SaveFailure
}

// ===== Past darajadagi o'qish/yozish =====

export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? undefined : (JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

export function getItem<T>(key: StorageKey, fallback: T, guard: (value: unknown) => value is T): T {
  const value = readJson(key)
  return guard(value) ? value : fallback
}

// 'quota' — brauzer xotirasi to'lgan; 'unavailable' — saqlash bloklangan yoki boshqa xato
export type SaveFailure = 'quota' | 'unavailable'
export type SaveResult = { ok: true } | { ok: false; reason: SaveFailure }

const SAVED: SaveResult = { ok: true }

// Brauzerlar xotira to'lishini turlicha nomlaydi (Chrome/Safari: 22, Firefox: 1014)
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22 || error.code === 1014
}

export function setItem<T>(key: string, value: T): SaveResult {
  try {
    const serialized = JSON.stringify(value)
    // Bir xil qiymatni qayta yozmaslik boshqa tablar bilan cheksiz sinxron aylanishining oldini oladi
    if (localStorage.getItem(key) !== serialized) {
      localStorage.setItem(key, serialized)
      notifyStorageChanged()
    }
    return SAVED
  } catch (error) {
    // Ilova xotiradagi holat bilan ishlashda davom etadi, lekin chaqiruvchi foydalanuvchini ogohlantirishi kerak
    return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable' }
  }
}

// Bir nechta yozuv natijasidan birinchi xato (bo'lmasa — muvaffaqiyat)
export function combineResults(results: readonly SaveResult[]): SaveResult {
  return results.find((r) => !r.ok) ?? SAVED
}

export function saveErrorMessage(reason: SaveFailure): string {
  return reason === 'quota'
    ? 'Ma\'lumot saqlanmadi: brauzer xotirasi to\'lgan. JSON zaxira oling.'
    : 'Ma\'lumot saqlanmadi: brauzer saqlashni bloklagan. JSON zaxira oling.'
}

// ===== Band joy (taxminiy) =====

// Ko'pchilik brauzerlarda localStorage limiti ~5 MB (aniq qiymatni brauzer bermaydi)
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024

export interface StorageUsage {
  bytes: number
  percent: number
}

// Brauzerlar satrlarni UTF-16 da saqlaydi: kalit + qiymat, har bir belgi ~2 bayt
export function estimateStorageUsage(storage: Storage = localStorage): StorageUsage {
  let chars = 0
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key === null) continue
      chars += key.length + (storage.getItem(key)?.length ?? 0)
    }
  } catch {
    // Saqlash bloklangan bo'lsa 0 deb hisoblanadi
  }
  const bytes = chars * 2
  return { bytes, percent: Math.min(100, (bytes / STORAGE_LIMIT_BYTES) * 100) }
}

// useSyncExternalStore uchun: har yozuvdan keyin obunachilar xabardor qilinadi, qiymat keshlanadi
const usageListeners = new Set<() => void>()
let usageSnapshot: StorageUsage | null = null

function notifyStorageChanged(): void {
  usageSnapshot = null
  for (const listener of usageListeners) listener()
}

export function subscribeStorageUsage(listener: () => void): () => void {
  usageListeners.add(listener)
  // Boshqa tabdagi yozuvlar ham band joyni o'zgartiradi
  window.addEventListener('storage', notifyStorageChanged)
  return () => {
    usageListeners.delete(listener)
    if (usageListeners.size === 0) window.removeEventListener('storage', notifyStorageChanged)
  }
}

export function getStorageUsage(): StorageUsage {
  usageSnapshot ??= estimateStorageUsage()
  return usageSnapshot
}

// ===== Migratsiyalar =====

// Kategoriyasi yo'q eski tranzaksiyalar uchun izoh va turiga qarab taxmin
export function inferCategory(type: TransactionType, note: string, customerId?: unknown): TransactionCategory {
  if (type === 'income') return customerId ? 'course_fee' : 'other_income'
  const text = note.toLowerCase()
  if (text.includes('ijara')) return 'rent'
  if (text.includes('maosh') || text.includes('oylik')) return 'salary'
  if (text.includes('reklama') || text.includes('marketing')) return 'marketing'
  if (text.includes('jihoz')) return 'equipment'
  if (text.includes('kommunal') || text.includes('elektr') || text.includes('internet')) return 'utilities'
  return 'other_expense'
}

// v1 -> v2: tranzaksiyaga kategoriya, bo'sh izohga ''
function migrateTransaction(value: unknown): unknown {
  if (!isRecord(value)) return value
  const note = typeof value.note === 'string' ? value.note : ''
  const type = value.type === 'income' || value.type === 'expense' ? value.type : null
  if (value.category !== undefined || !type) return { ...value, note }
  return { ...value, note, category: inferCategory(type, note, value.customerId) }
}

function usedCourses(customers: readonly Customer[]): string[] {
  return Array.from(new Set([...DEFAULT_SETTINGS.courses, ...customers.map((c) => c.course).filter(Boolean)]))
}

// Istalgan (eski yoki buzuq) xom ma'lumotdan joriy sxemaga mos ma'lumot yasaydi
export function normalizeData(raw: { customers: unknown; transactions: unknown; settings: unknown }): LoadResult {
  const rawCustomers = Array.isArray(raw.customers) ? raw.customers : []
  const rawTransactions = Array.isArray(raw.transactions) ? raw.transactions.map(migrateTransaction) : []
  const customers = keepValid(rawCustomers, isCustomer)
  const transactions = keepValid(rawTransactions, isTransaction)
  const settings = sanitizeSettings(raw.settings, usedCourses(customers))
  return {
    data: { customers, transactions, settings },
    dropped: rawCustomers.length - customers.length + (rawTransactions.length - transactions.length),
  }
}

// ===== Yuqori darajadagi API =====

export function saveAll(data: StoredData): SaveResult {
  return combineResults([
    setItem(STORAGE_KEYS.customers, data.customers),
    setItem(STORAGE_KEYS.transactions, data.transactions),
    setItem(STORAGE_KEYS.settings, data.settings),
    setItem(STORAGE_KEYS.seeded, true),
    setItem(STORAGE_KEYS.version, SCHEMA_VERSION),
  ])
}

export function createEmptyData(): StoredData {
  return { customers: [], transactions: [], settings: { ...DEFAULT_SETTINGS, courses: [...DEFAULT_SETTINGS.courses] } }
}

export function createMockData(): StoredData {
  return {
    customers: createMockCustomers(),
    transactions: createMockTransactions(),
    settings: { ...DEFAULT_SETTINGS, courses: [...DEFAULT_SETTINGS.courses] },
  }
}

export function readStored(): LoadResult {
  return normalizeData({
    customers: readJson(STORAGE_KEYS.customers),
    transactions: readJson(STORAGE_KEYS.transactions),
    settings: readJson(STORAGE_KEYS.settings),
  })
}

// ===== Birinchi ishga tushish va demo rejim =====

// Hali tanlov qilinmagan (bo'sh yoki demo). Mavjud foydalanuvchilarda apex:seeded === true
export function isFirstRun(): boolean {
  return readJson(STORAGE_KEYS.seeded) !== true
}

export function isDemoMode(): boolean {
  return readJson(STORAGE_KEYS.demo) === true
}

export function setDemoMode(demo: boolean): SaveResult {
  return setItem(STORAGE_KEYS.demo, demo)
}

// Tanlov ekranidan: 'empty' — bo'sh baza, 'demo' — namunaviy ma'lumot.
// Boshqa tabda allaqachon tanlangan bo'lsa, mavjud ma'lumot ustidan yozilmaydi.
export function startFresh(mode: 'empty' | 'demo'): SaveResult {
  if (!isFirstRun()) return { ok: true }
  const saved = saveAll(mode === 'demo' ? createMockData() : createEmptyData())
  return combineResults([saved, setDemoMode(mode === 'demo')])
}

// Eski versiya bo'lsa migratsiya qilinib qayta saqlanadi. Birinchi ishga tushishda hech narsa yozilmaydi —
// avval foydalanuvchi FirstRunScreen'da tanlov qiladi
export function loadData(): LoadResult {
  if (isFirstRun()) return { data: createEmptyData(), dropped: 0 }
  const result = readStored()
  const version = readJson(STORAGE_KEYS.version)
  if (version !== SCHEMA_VERSION || result.dropped > 0) {
    const saved = saveAll(result.data)
    if (!saved.ok) return { ...result, saveError: saved.reason }
  }
  return result
}

export function resetToMock(): { data: StoredData; saved: SaveResult } {
  const data = createMockData()
  return { data, saved: combineResults([saveAll(data), setDemoMode(true)]) }
}

// ===== Zaxira (JSON) =====

export interface Backup extends StoredData {
  app: 'apex-dashboard'
  version: number
  exportedAt: string
}

export function createBackup(data: StoredData): Backup {
  return { app: 'apex-dashboard', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...data }
}

export type BackupParseResult = { ok: true; data: StoredData; dropped: number; exportedAt?: string } | { ok: false; error: string }

export function parseBackup(text: string): BackupParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Fayl JSON formatida emas yoki buzilgan' }
  }
  if (!isRecord(json) || !Array.isArray(json.customers) || !Array.isArray(json.transactions)) {
    return { ok: false, error: 'Bu Apex Dashboard zaxira fayli emas: mijozlar yoki tranzaksiyalar ro\'yxati topilmadi' }
  }
  if (typeof json.version === 'number' && json.version > SCHEMA_VERSION) {
    return { ok: false, error: 'Zaxira ilovaning yangiroq versiyasida yaratilgan' }
  }
  const { data, dropped } = normalizeData({ customers: json.customers, transactions: json.transactions, settings: json.settings })
  return { ok: true, data, dropped, exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : undefined }
}
