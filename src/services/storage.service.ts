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

export function setItem<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value)
    // Bir xil qiymatni qayta yozmaslik boshqa tablar bilan cheksiz sinxron aylanishining oldini oladi
    if (localStorage.getItem(key) !== serialized) localStorage.setItem(key, serialized)
  } catch {
    // Xotira to'lgan yoki brauzer saqlashni bloklagan — ilova xotiradagi holat bilan ishlashda davom etadi
  }
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

export function saveAll(data: StoredData): void {
  setItem(STORAGE_KEYS.customers, data.customers)
  setItem(STORAGE_KEYS.transactions, data.transactions)
  setItem(STORAGE_KEYS.settings, data.settings)
  setItem(STORAGE_KEYS.seeded, true)
  setItem(STORAGE_KEYS.version, SCHEMA_VERSION)
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

// Birinchi ishga tushishda demo ma'lumot yoziladi; eski versiya bo'lsa migratsiya qilinib qayta saqlanadi
export function loadData(): LoadResult {
  if (readJson(STORAGE_KEYS.seeded) !== true) {
    const mock = createMockData()
    saveAll(mock)
    return { data: mock, dropped: 0 }
  }
  const result = readStored()
  const version = readJson(STORAGE_KEYS.version)
  if (version !== SCHEMA_VERSION || result.dropped > 0) saveAll(result.data)
  return result
}

export function resetToMock(): StoredData {
  const mock = createMockData()
  saveAll(mock)
  return mock
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
