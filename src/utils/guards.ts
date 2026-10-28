import { DEFAULT_SETTINGS } from '../constants/mockData'
import type { Customer, CustomerSource, CustomerStatus } from '../types/customer.types'
import type { CsvDelimiter, Currency, DateFormat, Settings } from '../types/dashboard.types'
import type { PaymentMethod, Transaction, TransactionCategory, TransactionType } from '../types/finance.types'

// Record<T, true> ko'rinishi: yangi qiymat qo'shilsa TypeScript bu yerni ham yangilashni talab qiladi
const STATUSES: Record<CustomerStatus, true> = { lead: true, active: true, paused: true, left: true }
const SOURCES: Record<CustomerSource, true> = { telegram: true, instagram: true, website: true, referral: true }
const TYPES: Record<TransactionType, true> = { income: true, expense: true }
const METHODS: Record<PaymentMethod, true> = { payme: true, click: true, cash: true, bank: true }
const CATEGORY_TYPE: Record<TransactionCategory, TransactionType> = {
  course_fee: 'income',
  other_income: 'income',
  rent: 'expense',
  salary: 'expense',
  marketing: 'expense',
  equipment: 'expense',
  utilities: 'expense',
  other_expense: 'expense',
}
const CURRENCIES: Record<Currency, true> = { UZS: true, USD: true }
const DATE_FORMATS: Record<DateFormat, true> = { 'dd.mm.yyyy': true, 'dd/mm/yyyy': true, 'yyyy-mm-dd': true }
const DELIMITERS: Record<CsvDelimiter, true> = { ';': true, ',': true }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneOf<T extends string>(allowed: Record<T, unknown>, value: unknown): value is T {
  return typeof value === 'string' && Object.hasOwn(allowed, value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function isCustomer(value: unknown): value is Customer {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.name) &&
    typeof value.phone === 'string' &&
    typeof value.course === 'string' &&
    oneOf(STATUSES, value.status) &&
    oneOf(SOURCES, value.source) &&
    isIsoDate(value.createdAt) &&
    isOptionalString(value.email) &&
    isOptionalString(value.note) &&
    (value.updatedAt === undefined || isIsoDate(value.updatedAt))
  )
}

export function isTransaction(value: unknown): value is Transaction {
  return (
    isRecord(value) &&
    isText(value.id) &&
    oneOf(TYPES, value.type) &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    oneOf(METHODS, value.method) &&
    oneOf(CATEGORY_TYPE, value.category) &&
    CATEGORY_TYPE[value.category] === value.type &&
    typeof value.note === 'string' &&
    isOptionalString(value.customerId) &&
    isIsoDate(value.date) &&
    (value.updatedAt === undefined || isIsoDate(value.updatedAt))
  )
}

export function isSettings(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    isText(value.orgName) &&
    typeof value.logoText === 'string' &&
    typeof value.phone === 'string' &&
    typeof value.address === 'string' &&
    oneOf(CURRENCIES, value.currency) &&
    oneOf(DATE_FORMATS, value.dateFormat) &&
    oneOf(DELIMITERS, value.csvDelimiter) &&
    isText(value.adminLogin) &&
    Array.isArray(value.courses) &&
    value.courses.every(isText)
  )
}

// Har bir maydon alohida tekshiriladi: noto'g'ri maydon standart qiymat bilan almashtiriladi
export function sanitizeSettings(value: unknown, fallbackCourses: readonly string[] = DEFAULT_SETTINGS.courses): Settings {
  const raw = isRecord(value) ? value : {}
  const courses = Array.isArray(raw.courses) ? raw.courses.filter(isText).map((c) => c.trim()) : [...fallbackCourses]
  return {
    orgName: isText(raw.orgName) ? raw.orgName : DEFAULT_SETTINGS.orgName,
    logoText: typeof raw.logoText === 'string' ? raw.logoText.slice(0, 3) : DEFAULT_SETTINGS.logoText,
    phone: typeof raw.phone === 'string' ? raw.phone : DEFAULT_SETTINGS.phone,
    address: typeof raw.address === 'string' ? raw.address : DEFAULT_SETTINGS.address,
    currency: oneOf(CURRENCIES, raw.currency) ? raw.currency : DEFAULT_SETTINGS.currency,
    dateFormat: oneOf(DATE_FORMATS, raw.dateFormat) ? raw.dateFormat : DEFAULT_SETTINGS.dateFormat,
    csvDelimiter: oneOf(DELIMITERS, raw.csvDelimiter) ? raw.csvDelimiter : DEFAULT_SETTINGS.csvDelimiter,
    adminLogin: isText(raw.adminLogin) ? raw.adminLogin : DEFAULT_SETTINGS.adminLogin,
    courses: Array.from(new Set(courses)),
  }
}

// Ro'yxatdan faqat to'g'ri va id bo'yicha takrorlanmagan yozuvlar qoladi
export function keepValid<T extends { id: string }>(items: readonly unknown[], guard: (value: unknown) => value is T): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (!guard(item) || seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}
