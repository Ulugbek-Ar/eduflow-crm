import { tr } from '../i18n'
import { DEFAULT_SETTINGS } from '../constants/mockData'
import type { Course } from '../types/course.types'
import type { Teacher } from '../types/teacher.types'
import type { Enrollment, Group } from '../types/group.types'
import type { AttendanceRecord, LessonException } from '../types/attendance.types'
import type { Customer, CustomerStatus, LegacyCustomerStatus } from '../types/customer.types'
import type { Settings } from '../types/dashboard.types'
import type { LegacyPaymentMethod, PaymentMethod, Transaction, TransactionCategory, TransactionType } from '../types/finance.types'
import {
  isAttendanceRecord,
  isCourse,
  isCustomer,
  isEnrollment,
  isGroup,
  isLessonException,
  isRecord,
  isTeacher,
  isTransaction,
  keepValid,
  sanitizeSettings,
} from '../utils/guards'
import { APP_NAME, BACKUP_APP_ID } from '../constants/app'

export const STORAGE_KEYS = {
  customers: 'apex:customers',
  transactions: 'apex:transactions',
  settings: 'apex:settings',
  courses: 'apex:courses',
  seeded: 'apex:seeded',
  version: 'apex:version',
  // Demo ma'lumot bilan boshlangan (Header'da belgi va tozalash tugmasi ko'rinadi)
  demo: 'apex:demo',
  // v11: o'qituvchilar, guruhlar, o'qish (enrollment), davomat, bekor qilingan darslar
  teachers: 'apex:teachers',
  groups: 'apex:groups',
  enrollments: 'apex:enrollments',
  attendance: 'apex:attendance',
  lessonExceptions: 'apex:lesson-exceptions',
  // v10 -> v11 migratsiyasidan oldin avtomatik olingan JSON zaxira (Sozlamalar -> Ma'lumotlar'dan yuklab olinadi)
  preMigrationBackup: 'apex:backup-pre-v11',
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

// v1 — MVP; v2 — category, ixtiyoriy mijoz maydonlari, kengaytirilgan sozlamalar;
// v3 — tranzaksiyada mijoz nomi snapshot'i (customerName);
// v4 — sozlamalarda profil (profileName, profileRole);
// v5 — mijoz holatlari sotuv voronkasi bosqichlariga (LEGACY_STATUS_MAP);
// v6 — kurslar alohida entity (apex:courses), settings.courses olib tashlandi;
// v7 — tranzaksiyada to'lov turi (LEGACY_METHOD_MAP), status va marketing manbasi;
// v8 — sozlamalarda logotip rasmi (settings.logoImage);
// v9 — mijozda "To'lov qildi" bosqichiga o'tgan vaqt (customer.paidAt);
// v10 — kurs davomiyligi noma'lum bo'lsa 0 ("muddatsiz"), v6 migratsiyasidagi "1 oy" tuzatiladi;
// v11 — o'qituvchilar, guruhlar, enrollment, davomat; "To'lov qildi" o'quvchilari kurs bo'yicha "1-guruh"ga yoziladi,
//       Course.activeGroups olib tashlanadi (guruhlardan hisoblanadi); tranzaksiyada enrollmentId, teacherId, period
export const SCHEMA_VERSION = 11

export interface StoredData {
  customers: Customer[]
  transactions: Transaction[]
  courses: Course[]
  settings: Settings
  teachers: Teacher[]
  groups: Group[]
  enrollments: Enrollment[]
  attendance: AttendanceRecord[]
  lessonExceptions: LessonException[]
}

// StoredData'dagi ro'yxat kalitlari (sozlamalardan tashqari) — saqlash, sinxron va tablar orasida bir xil tartibda
export const LIST_KEYS = ['customers', 'transactions', 'courses', 'teachers', 'groups', 'enrollments', 'attendance', 'lessonExceptions'] as const
export type ListKey = (typeof LIST_KEYS)[number]

export interface LoadResult {
  data: StoredData
  // Tekshiruvdan o'tmay tashlab yuborilgan yozuvlar soni
  dropped: number
  // Yuklashda qayta saqlash (migratsiya) muvaffaqiyatsiz bo'lsa
  saveError?: SaveFailure
  // Migratsiyadan oldingi avtomatik nusxani yozib bo'lmadi (odatda xotira to'lgan)
  backupError?: SaveFailure
}

// ===== Nom maydoni: haqiqiy ma'lumot va demo =====
// Demo rejimda barcha apex:* kalitlari eduflow-demo:* ga yoziladi — "Demo'ni ko'rish" haqiqiy markaz
// ma'lumotiga hech qachon tegmaydi. Interfeys afzalliklari (mavzu, sidebar, til) ikkalasida umumiy

export type StorageNamespace = 'main' | 'demo'

export const DEMO_PREFIX = 'eduflow-demo:'
// Tab qaysi rejimda ochilgani (sessionStorage: tab yopilganda demo tugaydi)
export const MODE_KEY = 'eduflow:mode'
const SHARED_KEYS: ReadonlySet<string> = new Set(['apex:theme', 'apex:sidebar-collapsed', 'apex:customers-view', 'apex:lang'])

let namespace: StorageNamespace = 'main'

export function getStorageNamespace(): StorageNamespace {
  return namespace
}

export function setStorageNamespace(next: StorageNamespace): void {
  namespace = next
  try {
    if (next === 'demo') sessionStorage.setItem(MODE_KEY, 'demo')
    else sessionStorage.removeItem(MODE_KEY)
  } catch {
    // sessionStorage bloklangan — rejim faqat shu sahifa davomida
  }
}

// Ilova ishga tushganda: tab avval demo rejimda bo'lgan bo'lsa, shu rejimda davom etadi
export function initStorageNamespace(): StorageNamespace {
  try {
    namespace = sessionStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'main'
  } catch {
    namespace = 'main'
  }
  return namespace
}

export function physicalKey(key: string): string {
  if (namespace !== 'demo' || !key.startsWith('apex:') || SHARED_KEYS.has(key)) return key
  return `${DEMO_PREFIX}${key.slice('apex:'.length)}`
}

// Demo'dan chiqishda yoki qayta boshlashda — demo kalitlari butunlay o'chiriladi
export function clearDemoStorage(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(DEMO_PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // e'tiborsiz
  }
}

// ===== Past darajadagi o'qish/yozish =====

export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(physicalKey(key))
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
export type SaveFailure = 'quota' | 'unavailable' | 'network'
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
    const target = physicalKey(key)
    // Bir xil qiymatni qayta yozmaslik boshqa tablar bilan cheksiz sinxron aylanishining oldini oladi
    if (localStorage.getItem(target) !== serialized) {
      localStorage.setItem(target, serialized)
      notifyStorageChanged()
    }
    return SAVED
  } catch (error) {
    // Ilova xotiradagi holat bilan ishlashda davom etadi, lekin chaqiruvchi foydalanuvchini ogohlantirishi kerak
    return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable' }
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(physicalKey(key))
    notifyStorageChanged()
  } catch {
    // e'tiborsiz
  }
}

// Bir nechta yozuv natijasidan birinchi xato (bo'lmasa — muvaffaqiyat)
export function combineResults(results: readonly SaveResult[]): SaveResult {
  return results.find((r) => !r.ok) ?? SAVED
}

export function saveErrorMessage(reason: SaveFailure): string {
  if (reason === 'network') return tr('O\'zgarish serverga yetib bormadi. Internetni tekshiring — keyingi o\'zgarishda qayta yuboriladi.')
  return reason === 'quota'
    ? tr('Ma\'lumot saqlanmadi: brauzer xotirasi to\'lgan. JSON zaxira oling.')
    : tr('Ma\'lumot saqlanmadi: brauzer saqlashni bloklagan. JSON zaxira oling.')
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

// v4 -> v5: eski holat -> voronka bosqichi
export const LEGACY_STATUS_MAP: Record<LegacyCustomerStatus, CustomerStatus> = {
  lead: 'new',
  active: 'paid',
  paused: 'thinking',
  left: 'cancelled',
}

function migrateCustomer(value: unknown): unknown {
  if (!isRecord(value) || typeof value.status !== 'string' || !Object.hasOwn(LEGACY_STATUS_MAP, value.status)) return value
  return { ...value, status: LEGACY_STATUS_MAP[value.status as LegacyCustomerStatus] }
}

// v6 -> v7: eski to'lov usuli -> to'lov turi (cash o'zgarmaydi)
export const LEGACY_METHOD_MAP: Record<LegacyPaymentMethod, PaymentMethod> = {
  payme: 'card',
  click: 'card',
  bank: 'transfer',
}

// v1 -> v2: kategoriya va bo'sh izoh; v6 -> v7: to'lov turi va status (eski yozuvlar to'langan hisoblanadi)
function migrateTransaction(value: unknown): unknown {
  if (!isRecord(value)) return value
  const note = typeof value.note === 'string' ? value.note : ''
  const type = value.type === 'income' || value.type === 'expense' ? value.type : null
  const legacy = typeof value.method === 'string' && Object.hasOwn(LEGACY_METHOD_MAP, value.method)
  const method = legacy ? LEGACY_METHOD_MAP[value.method as LegacyPaymentMethod] : value.method
  const status = value.status === undefined ? 'paid' : value.status
  const base = { ...value, note, method, status }
  if (value.category !== undefined || !type) return base
  return { ...base, category: inferCategory(type, note, value.customerId) }
}

// v2 -> v3: mijozi bazada bor tranzaksiyalarga ism snapshot'i ko'chiriladi
export function fillCustomerNames(transactions: readonly Transaction[], customers: readonly Customer[]): Transaction[] {
  const names = new Map(customers.map((c) => [c.id, c.name]))
  return transactions.map((t) => {
    if (!t.customerId || t.customerName) return t
    const name = names.get(t.customerId)
    return name ? { ...t, customerName: name } : t
  })
}

// v8 -> v9: "To'lov qildi" bosqichidagi mijozga paidAt — birinchi to'langan kirim sanasi, bo'lmasa qo'shilgan sana.
// Boshqa bosqichdagi mijozda paidAt bo'lmaydi
export function fillPaidAt(customers: readonly Customer[], transactions: readonly Transaction[]): Customer[] {
  const firstPayment = new Map<string, string>()
  for (const t of transactions) {
    if (t.type !== 'income' || t.status !== 'paid' || !t.customerId) continue
    const known = firstPayment.get(t.customerId)
    if (!known || t.date < known) firstPayment.set(t.customerId, t.date)
  }
  return customers.map((c) => {
    if (c.status !== 'paid') {
      if (c.paidAt === undefined) return c
      const { paidAt: _paidAt, ...rest } = c
      return rest
    }
    return c.paidAt ? c : { ...c, paidAt: firstPayment.get(c.id) ?? c.createdAt }
  })
}

// v5 -> v6: kurslar ro'yxati (settings.courses) va mijozlarda uchraydigan kurs nomlari to'liq kursga aylanadi.
// Narx 0 (keyin to'ldiriladi), davomiyligi 1 oy, guruhlar 0, holati faol
export function migrateCourses(rawSettings: unknown, customers: readonly Customer[], now = new Date()): Course[] {
  const listed = isRecord(rawSettings) && Array.isArray(rawSettings.courses) ? rawSettings.courses : []
  const names: string[] = []
  for (const value of [...listed, ...customers.map((c) => c.course)]) {
    if (typeof value !== 'string') continue
    const name = value.trim().replace(/\s+/g, ' ')
    if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name)
  }
  return names.map((name, index) => ({
    id: `k${index + 1}`,
    name,
    type: 'course',
    // Davomiylik noma'lum — "muddatsiz" (0): kurs muddati tugadi deb qarzdorlar yashirinib qolmasin
    durationMonths: 0,
    monthlyPrice: 0,
    status: 'active',
    createdAt: now.toISOString(),
  }))
}

// v9 -> v10: v6 migratsiyasi yaratgan kurslarda (aynan: kurs, 1 oy, narx 0, 0 guruh) davomiylik aslida
// noma'lum edi — "muddatsiz" qilinadi. Faqat v10 dan eski ma'lumotga qo'llanadi (yangi 1 oylik kurslarga tegmaydi).
// activeGroups v11 da olib tashlangan, lekin eski yozuvlarda bor — xom qiymat tekshiriladi
export function fixLegacyCourseDuration(courses: readonly Course[], fromVersion: number): Course[] {
  if (fromVersion >= 10) return [...courses]
  return courses.map((c) => {
    const legacyGroups = (c as Course & { activeGroups?: unknown }).activeGroups
    return c.type === 'course' && c.durationMonths === 1 && c.monthlyPrice === 0 && (legacyGroups === 0 || legacyGroups === undefined) ? { ...c, durationMonths: 0 } : c
  })
}

// v11: eski maydonni olib tashlash (faol guruhlar soni guruhlardan hisoblanadi)
export function stripLegacyCourseFields(courses: readonly Course[]): Course[] {
  return courses.map((c) => {
    if (!('activeGroups' in c)) return c
    const { activeGroups: _legacy, ...rest } = c as Course & { activeGroups?: unknown }
    return rest
  })
}

// 'YYYY-MM-DD' (mahalliy vaqt bo'yicha)
export function isoDay(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// v10 -> v11: "To'lov qildi" bosqichidagi, hali hech qaysi guruhga yozilmagan o'quvchilar kurs bo'yicha
// "{Kurs} — 1-guruh"ga yoziladi (Du/Cho/Ju, 14:00–15:30, o'qituvchisiz, boshlanishi — eng erta paidAt), har biriga
// paidAt dan boshlanadigan enrollment. Idempotent: id'lar deterministik (g-<kurs>-1, e-<mijoz>), mavjudlari takrorlanmaydi
export function migrateStudentsToGroups(
  customers: readonly Customer[],
  courses: readonly Course[],
  groups: readonly Group[],
  enrollments: readonly Enrollment[],
  now = new Date(),
): { groups: Group[]; enrollments: Enrollment[] } {
  const nextGroups = [...groups]
  const nextEnrollments = [...enrollments]
  const enrolled = new Set(enrollments.map((e) => e.customerId))
  const groupIds = new Set(groups.map((g) => g.id))
  const enrollmentIds = new Set(enrollments.map((e) => e.id))
  const createdAt = now.toISOString()
  for (const course of courses) {
    const students = customers.filter((c) => c.status === 'paid' && c.course === course.name && !enrolled.has(c.id))
    if (students.length === 0) continue
    const groupId = `g-${course.id}-1`
    const startDays = students.map((c) => isoDay(c.paidAt ?? c.createdAt))
    if (!groupIds.has(groupId)) {
      nextGroups.push({
        id: groupId,
        name: `${course.name} — 1-guruh`,
        courseId: course.id,
        room: '',
        days: ['mon', 'wed', 'fri'],
        startTime: '14:00',
        endTime: '15:30',
        capacity: Math.max(12, students.length),
        startDate: startDays.reduce((min, day) => (day < min ? day : min)),
        status: 'active',
        createdAt,
      })
      groupIds.add(groupId)
    }
    for (const [index, student] of students.entries()) {
      const id = `e-${student.id}`
      if (enrollmentIds.has(id)) continue
      nextEnrollments.push({ id, customerId: student.id, groupId, startDate: startDays[index], status: 'active', createdAt })
      enrollmentIds.add(id)
      enrolled.add(student.id)
    }
  }
  return { groups: nextGroups, enrollments: nextEnrollments }
}

// Davomat: (guruh, o'quvchi, sana) noyob — takror bo'lsa eng oxirgi o'zgargani qoladi
function uniqueAttendance(records: readonly AttendanceRecord[]): AttendanceRecord[] {
  const byKey = new Map<string, AttendanceRecord>()
  for (const r of records) {
    const key = `${r.groupId}|${r.customerId}|${r.date}`
    const known = byKey.get(key)
    if (!known || known.updatedAt < r.updatedAt) byKey.set(key, r)
  }
  return [...byKey.values()]
}

function uniqueExceptions(items: readonly LessonException[]): LessonException[] {
  const seen = new Set<string>()
  return items.filter((e) => {
    const key = `${e.groupId}|${e.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Kurs nomlari takrorlanmasligi kerak (mijoz kursga nom orqali bog'lanadi)
function uniqueCourseNames(courses: readonly Course[]): Course[] {
  const seen = new Set<string>()
  return courses.filter((c) => {
    const key = c.name.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Istalgan (eski yoki buzuq) xom ma'lumotdan joriy sxemaga mos ma'lumot yasaydi
// fromVersion — ma'lumot qaysi sxema versiyasida yozilgan (versiyaga bog'liq migratsiyalar uchun); noma'lum bo'lsa joriy
export interface RawData {
  customers: unknown
  transactions: unknown
  settings: unknown
  courses?: unknown
  teachers?: unknown
  groups?: unknown
  enrollments?: unknown
  attendance?: unknown
  lessonExceptions?: unknown
}

export function normalizeData(raw: RawData, fromVersion: number = SCHEMA_VERSION): LoadResult {
  const rawCustomers = Array.isArray(raw.customers) ? raw.customers.map(migrateCustomer) : []
  const rawTransactions = Array.isArray(raw.transactions) ? raw.transactions.map(migrateTransaction) : []
  const valid = keepValid(rawTransactions, isTransaction)
  const customers = fillPaidAt(keepValid(rawCustomers, isCustomer), valid)
  const transactions = fillCustomerNames(valid, customers)
  const settings = sanitizeSettings(raw.settings)
  // Kurslar massivi bo'lsa (v6+) — tekshiriladi; bo'lmasa (eski ma'lumot/zaxira) — migratsiya
  const rawCourses = Array.isArray(raw.courses) ? raw.courses : null
  const courses = stripLegacyCourseFields(
    rawCourses ? fixLegacyCourseDuration(uniqueCourseNames(keepValid(rawCourses, isCourse)), fromVersion) : migrateCourses(raw.settings, customers),
  )
  // v11 ro'yxatlari: bo'lmasa — bo'sh
  const list = (value: unknown) => (Array.isArray(value) ? value : [])
  const teachers = keepValid(list(raw.teachers), isTeacher)
  let groups = keepValid(list(raw.groups), isGroup)
  let enrollments = keepValid(list(raw.enrollments), isEnrollment)
  const attendance = uniqueAttendance(keepValid(list(raw.attendance), isAttendanceRecord))
  const lessonExceptions = uniqueExceptions(keepValid(list(raw.lessonExceptions), isLessonException))
  // v10 -> v11: guruhlar hali yo'q bo'lsa — o'quvchilar kurs bo'yicha guruhlarga yoziladi
  if (fromVersion < 11 && !Array.isArray(raw.groups)) {
    const migrated = migrateStudentsToGroups(customers, courses, groups, enrollments)
    groups = migrated.groups
    enrollments = migrated.enrollments
  }
  const invalid = (rawList: unknown, kept: readonly unknown[]) => (Array.isArray(rawList) ? Math.max(0, rawList.length - kept.length) : 0)
  return {
    data: { customers, transactions, courses, settings, teachers, groups, enrollments, attendance, lessonExceptions },
    dropped:
      rawCustomers.length -
      customers.length +
      (rawTransactions.length - valid.length) +
      (rawCourses ? rawCourses.length - courses.length : 0) +
      invalid(raw.teachers, teachers) +
      (fromVersion < 11 ? 0 : invalid(raw.groups, groups) + invalid(raw.enrollments, enrollments)) +
      invalid(raw.attendance, attendance) +
      invalid(raw.lessonExceptions, lessonExceptions),
  }
}

// ===== Yuqori darajadagi API =====

export function saveAll(data: StoredData): SaveResult {
  return combineResults([
    ...LIST_KEYS.map((key) => setItem(STORAGE_KEYS[key], data[key])),
    setItem(STORAGE_KEYS.settings, data.settings),
    setItem(STORAGE_KEYS.seeded, true),
    setItem(STORAGE_KEYS.version, SCHEMA_VERSION),
  ])
}

// "Bo'sh boshlash": kurslar ham bo'sh — Kurslar va xizmatlar bo'limida qo'shiladi
export function createEmptyData(): StoredData {
  return {
    customers: [],
    transactions: [],
    courses: [],
    settings: { ...DEFAULT_SETTINGS },
    teachers: [],
    groups: [],
    enrollments: [],
    attendance: [],
    lessonExceptions: [],
  }
}

// Saqlangan xom qiymatlar (normalizatsiyasiz) — migratsiyadan oldingi zaxira uchun
function readRaw(): RawData {
  return {
    customers: readJson(STORAGE_KEYS.customers),
    transactions: readJson(STORAGE_KEYS.transactions),
    settings: readJson(STORAGE_KEYS.settings),
    courses: readJson(STORAGE_KEYS.courses),
    teachers: readJson(STORAGE_KEYS.teachers),
    groups: readJson(STORAGE_KEYS.groups),
    enrollments: readJson(STORAGE_KEYS.enrollments),
    attendance: readJson(STORAGE_KEYS.attendance),
    lessonExceptions: readJson(STORAGE_KEYS.lessonExceptions),
  }
}


export function readStored(fromVersion: number = SCHEMA_VERSION): LoadResult {
  return normalizeData(readRaw(), fromVersion)
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
// Administrator ro'yxatdan o'tishda kiritgan sozlamalar (markaz nomi) saqlanib qoladi.
// demo — tayyor demo ma'lumot (services/demo/load.ts: loadDemoData), bo'lmasa bo'sh baza
export function startFresh(mode: 'empty' | 'demo', demo?: StoredData): SaveResult {
  if (!isFirstRun()) return { ok: true }
  const data = mode === 'demo' && demo ? demo : createEmptyData()
  const stored = readJson(STORAGE_KEYS.settings)
  const saved = saveAll(stored === undefined ? data : { ...data, settings: sanitizeSettings(stored) })
  return combineResults([saved, setDemoMode(mode === 'demo')])
}

// Sozlash ustasi oxirida: markaz ma'lumotlari, birinchi kurslar (yoki zaxiradan tiklangan ma'lumot) yoziladi.
// Boshqa tabda allaqachon sozlangan bo'lsa — mavjud ma'lumot ustidan yozilmaydi
export function completeSetup(data: StoredData): SaveResult {
  if (!isFirstRun()) return SAVED
  return combineResults([saveAll(data), setDemoMode(false)])
}

// Ma'lumotlar paneli hali ochilmagan paytda (ro'yxatdan o'tish ekrani) sozlamani yozish
export function updateStoredSettings(patch: Partial<Settings>): SaveResult {
  return setItem(STORAGE_KEYS.settings, { ...sanitizeSettings(readJson(STORAGE_KEYS.settings)), ...patch })
}

// Eski versiya bo'lsa migratsiya qilinib qayta saqlanadi. Birinchi ishga tushishda hech narsa yozilmaydi —
// avval foydalanuvchi FirstRunScreen'da tanlov qiladi
export function loadData(): LoadResult {
  if (isFirstRun()) return { data: createEmptyData(), dropped: 0 }
  const version = readJson(STORAGE_KEYS.version)
  const fromVersion = typeof version === 'number' ? version : 1
  // v11 gacha bo'lgan ma'lumot: migratsiyadan oldin xom holati zaxiraga (bir marta; mavjud zaxira ustidan yozilmaydi)
  let backupError: SaveFailure | undefined
  if (fromVersion < 11 && readJson(STORAGE_KEYS.preMigrationBackup) === undefined) {
    const backup = setItem(STORAGE_KEYS.preMigrationBackup, { app: BACKUP_APP_ID, version: fromVersion, exportedAt: new Date().toISOString(), ...readRaw() })
    if (!backup.ok) backupError = backup.reason
  }
  const stored = readStored(fromVersion)
  const result: LoadResult = backupError ? { ...stored, backupError } : stored
  if (version !== SCHEMA_VERSION || result.dropped > 0) {
    const saved = saveAll(result.data)
    if (!saved.ok) return { ...result, saveError: saved.reason }
  }
  return result
}

// data — services/demo/load.ts dagi loadDemoData() natijasi
export function resetToMock(data: StoredData): { data: StoredData; saved: SaveResult } {
  return { data, saved: combineResults([saveAll(data), setDemoMode(true)]) }
}

// ===== Zaxira (JSON) =====

export interface Backup extends StoredData {
  app: typeof BACKUP_APP_ID
  version: number
  exportedAt: string
}

export function createBackup(data: StoredData): Backup {
  return { app: BACKUP_APP_ID, version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...data }
}

export type BackupParseResult = { ok: true; data: StoredData; dropped: number; exportedAt?: string } | { ok: false; error: string }

export function parseBackup(text: string): BackupParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: tr('Fayl JSON formatida emas yoki buzilgan') }
  }
  if (!isRecord(json) || !Array.isArray(json.customers) || !Array.isArray(json.transactions)) {
    return { ok: false, error: tr('Bu {0} zaxira fayli emas: mijozlar yoki tranzaksiyalar ro\'yxati topilmadi', { 0: APP_NAME }) }
  }
  if (typeof json.version === 'number' && json.version > SCHEMA_VERSION) {
    return { ok: false, error: tr('Zaxira ilovaning yangiroq versiyasida yaratilgan') }
  }
  const fromVersion = typeof json.version === 'number' ? json.version : 1
  const { data, dropped } = normalizeData(
    {
      customers: json.customers,
      transactions: json.transactions,
      settings: json.settings,
      courses: json.courses,
      teachers: json.teachers,
      groups: json.groups,
      enrollments: json.enrollments,
      attendance: json.attendance,
      lessonExceptions: json.lessonExceptions,
    },
    fromVersion,
  )
  return { ok: true, data, dropped, exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : undefined }
}

// Migratsiyadan oldingi zaxira (v10 -> v11) — bor bo'lsa, Sozlamalar -> Ma'lumotlar'da yuklab olinadi
export function readPreMigrationBackup(): Record<string, unknown> | null {
  const value = readJson(STORAGE_KEYS.preMigrationBackup)
  return isRecord(value) ? value : null
}

// Nusxa butun bazaning ikkinchi nusxasi — brauzer xotirasini (~5 MB) tejash uchun foydalanuvchi o'chira oladi;
// "Barcha ma'lumotni tozalash" ham o'chiradi (mijozlar ma'lumoti brauzerda qolib ketmasin)
export function removePreMigrationBackup(): void {
  removeItem(STORAGE_KEYS.preMigrationBackup)
}
