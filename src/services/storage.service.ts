import { createMockCustomers, createMockTransactions, DEFAULT_SETTINGS } from '../constants/mockData'
import type { Customer } from '../types/customer.types'
import type { Settings } from '../types/dashboard.types'
import type { Transaction } from '../types/finance.types'

export const STORAGE_KEYS = {
  customers: 'apex:customers',
  transactions: 'apex:transactions',
  settings: 'apex:settings',
  seeded: 'apex:seeded',
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export interface StoredData {
  customers: Customer[]
  transactions: Transaction[]
  settings: Settings
}

export function getItem<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    // Tuzilma mos kelmasa (masalan, massiv o'rniga obyekt) — default qaytariladi
    if (parsed === null || typeof parsed !== typeof fallback || Array.isArray(parsed) !== Array.isArray(fallback)) {
      return fallback
    }
    return parsed as T
  } catch {
    return fallback
  }
}

export function setItem<T>(key: StorageKey, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Xotira to'lgan yoki brauzer saqlashni bloklagan — ilova xotiradagi holat bilan ishlashda davom etadi
  }
}

function saveAll(data: StoredData): void {
  setItem(STORAGE_KEYS.customers, data.customers)
  setItem(STORAGE_KEYS.transactions, data.transactions)
  setItem(STORAGE_KEYS.settings, data.settings)
  setItem(STORAGE_KEYS.seeded, true)
}

export function createMockData(): StoredData {
  return {
    customers: createMockCustomers(),
    transactions: createMockTransactions(),
    settings: { ...DEFAULT_SETTINGS },
  }
}

// Birinchi ishga tushishda demo ma'lumotlarni yozadi, keyin saqlanganini o'qiydi
export function loadData(): StoredData {
  if (!getItem(STORAGE_KEYS.seeded, false)) {
    const mock = createMockData()
    saveAll(mock)
    return mock
  }
  return {
    customers: getItem<Customer[]>(STORAGE_KEYS.customers, []),
    transactions: getItem<Transaction[]>(STORAGE_KEYS.transactions, []),
    settings: { ...DEFAULT_SETTINGS, ...getItem<Partial<Settings>>(STORAGE_KEYS.settings, {}) },
  }
}

export function resetToMock(): StoredData {
  const mock = createMockData()
  saveAll(mock)
  return mock
}
