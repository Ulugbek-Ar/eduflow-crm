import { DEFAULT_REMINDER_RU, DEFAULT_REMINDER_UZ, DEFAULT_SETTINGS } from '../constants/mockData'
import type { Course, CourseStatus, CourseType } from '../types/course.types'
import type { Customer, CustomerSource, CustomerStatus } from '../types/customer.types'
import type { CsvDelimiter, Currency, DateFormat, Settings } from '../types/dashboard.types'
import type { PaymentMethod, Transaction, TransactionCategory, TransactionStatus, TransactionType } from '../types/finance.types'
import type { Enrollment, EnrollmentStatus, Group, GroupStatus, Weekday } from '../types/group.types'
import type { PayRule, Teacher, TeacherStatus } from '../types/teacher.types'
import type { AttendanceRecord, AttendanceStatus, LessonException } from '../types/attendance.types'

// Record<T, true> ko'rinishi: yangi qiymat qo'shilsa TypeScript bu yerni ham yangilashni talab qiladi
const STATUSES: Record<CustomerStatus, true> = { new: true, contacted: true, thinking: true, paid: true, cancelled: true }
const SOURCES: Record<CustomerSource, true> = { telegram: true, instagram: true, website: true, referral: true }
const TYPES: Record<TransactionType, true> = { income: true, expense: true }
const METHODS: Record<PaymentMethod, true> = { cash: true, card: true, transfer: true }
const TX_STATUSES: Record<TransactionStatus, true> = { paid: true, pending: true, cancelled: true }
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
const COURSE_TYPES: Record<CourseType, true> = { course: true, service: true }
const COURSE_STATUSES: Record<CourseStatus, true> = { active: true, archived: true }
const CURRENCIES: Record<Currency, true> = { UZS: true, USD: true }
const DATE_FORMATS: Record<DateFormat, true> = { 'dd.mm.yyyy': true, 'dd/mm/yyyy': true, 'yyyy-mm-dd': true }
const DELIMITERS: Record<CsvDelimiter, true> = { ';': true, ',': true }
export const WEEKDAYS_RECORD: Record<Weekday, true> = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
const GROUP_STATUSES: Record<GroupStatus, true> = { active: true, finished: true, archived: true }
const ENROLLMENT_STATUSES: Record<EnrollmentStatus, true> = { active: true, paused: true, finished: true, left: true }
const TEACHER_STATUSES: Record<TeacherStatus, true> = { active: true, archived: true }
const ATTENDANCE_STATUSES: Record<AttendanceStatus, true> = { present: true, absent: true, late: true, excused: true }

// 'YYYY-MM-DD' (haqiqiy sana)
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

// 'HH:MM' (00:00–23:59)
export function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

// 'YYYY-MM'
export function isPeriod(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function isOptionalDay(value: unknown): boolean {
  return value === undefined || isDay(value)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function oneOf<T extends string>(allowed: Record<T, unknown>, value: unknown): value is T {
  return typeof value === 'string' && Object.hasOwn(allowed, value)
}

export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

export function isIsoDate(value: unknown): value is string {
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
    (value.updatedAt === undefined || isIsoDate(value.updatedAt)) &&
    (value.paidAt === undefined || isIsoDate(value.paidAt))
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
    isOptionalString(value.customerName) &&
    oneOf(TX_STATUSES, value.status) &&
    (value.source === undefined || (value.category === 'marketing' && oneOf(SOURCES, value.source))) &&
    isIsoDate(value.date) &&
    (value.updatedAt === undefined || isIsoDate(value.updatedAt)) &&
    (value.enrollmentId === undefined || isText(value.enrollmentId)) &&
    (value.teacherId === undefined || isText(value.teacherId)) &&
    (value.period === undefined || isPeriod(value.period))
  )
}

// Logotip: 200 KB gacha rasm, base64 data URL ko'rinishida (base64 hajmni ~4/3 ga oshiradi)
export const LOGO_MAX_BYTES = 200 * 1024
const LOGO_MAX_LENGTH = Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 64
const LOGO_PATTERN = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+=*$/

export function isLogoDataUrl(value: string): boolean {
  return value.length <= LOGO_MAX_LENGTH && LOGO_PATTERN.test(value)
}

export function isSettings(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    isText(value.orgName) &&
    typeof value.logoText === 'string' &&
    typeof value.logoImage === 'string' &&
    (value.logoImage === '' || isLogoDataUrl(value.logoImage)) &&
    typeof value.phone === 'string' &&
    typeof value.address === 'string' &&
    oneOf(CURRENCIES, value.currency) &&
    oneOf(DATE_FORMATS, value.dateFormat) &&
    oneOf(DELIMITERS, value.csvDelimiter) &&
    isText(value.adminLogin) &&
    typeof value.profileName === 'string' &&
    typeof value.profileRole === 'string' &&
    isWholeNumber(value.attendanceEditDays, 0, 60) &&
    typeof value.prorateFirstMonth === 'boolean' &&
    isWholeNumber(value.paymentDueDay, 1, 28) &&
    typeof value.reminderTemplateUz === 'string' &&
    typeof value.reminderTemplateRu === 'string'
  )
}

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export const COURSE_LIMITS = { maxDuration: 60, maxPrice: 1_000_000_000_000 } as const

// v10 dagi activeGroups maydoni bo'lishi mumkin (migratsiya olib tashlaydi) — tekshiruvga ta'sir qilmaydi
export function isCourse(value: unknown): value is Course {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.name) &&
    oneOf(COURSE_TYPES, value.type) &&
    // 0 — muddatsiz (davomiylik noma'lum yoki chegaralanmagan)
    isWholeNumber(value.durationMonths, 0, COURSE_LIMITS.maxDuration) &&
    isWholeNumber(value.monthlyPrice, 0, COURSE_LIMITS.maxPrice) &&
    oneOf(COURSE_STATUSES, value.status) &&
    isIsoDate(value.createdAt) &&
    (value.updatedAt === undefined || isIsoDate(value.updatedAt))
  )
}

// ===== v11: o'qituvchi, guruh, o'qish, davomat =====

export const GROUP_LIMITS = { maxCapacity: 500, maxNameLength: 80 } as const

export function isPayRule(value: unknown): value is PayRule {
  if (!isRecord(value)) return false
  if (value.type === 'fixed' || value.type === 'perStudent') return isWholeNumber(value.amount, 0, COURSE_LIMITS.maxPrice)
  if (value.type === 'percent') return typeof value.percent === 'number' && Number.isFinite(value.percent) && value.percent >= 0 && value.percent <= 100
  return false
}

export function isTeacher(value: unknown): value is Teacher {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.name) &&
    typeof value.phone === 'string' &&
    Array.isArray(value.subjects) &&
    value.subjects.every((s) => typeof s === 'string') &&
    isPayRule(value.payRule) &&
    (value.userId === undefined || isText(value.userId)) &&
    oneOf(TEACHER_STATUSES, value.status) &&
    isIsoDate(value.createdAt) &&
    (value.updatedAt === undefined || isIsoDate(value.updatedAt))
  )
}

export function isGroup(value: unknown): value is Group {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.name) &&
    isText(value.courseId) &&
    (value.teacherId === undefined || isText(value.teacherId)) &&
    typeof value.room === 'string' &&
    Array.isArray(value.days) &&
    value.days.length > 0 &&
    value.days.every((d) => oneOf(WEEKDAYS_RECORD, d)) &&
    isTime(value.startTime) &&
    isTime(value.endTime) &&
    value.endTime > value.startTime &&
    isWholeNumber(value.capacity, 1, GROUP_LIMITS.maxCapacity) &&
    isDay(value.startDate) &&
    isOptionalDay(value.endDate) &&
    oneOf(GROUP_STATUSES, value.status) &&
    isIsoDate(value.createdAt) &&
    (value.updatedAt === undefined || isIsoDate(value.updatedAt))
  )
}

export function isEnrollment(value: unknown): value is Enrollment {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.customerId) &&
    isText(value.groupId) &&
    isDay(value.startDate) &&
    isOptionalDay(value.endDate) &&
    (value.priceOverride === undefined || isWholeNumber(value.priceOverride, 0, COURSE_LIMITS.maxPrice)) &&
    (value.discountPercent === undefined ||
      (typeof value.discountPercent === 'number' && Number.isFinite(value.discountPercent) && value.discountPercent >= 0 && value.discountPercent <= 100)) &&
    oneOf(ENROLLMENT_STATUSES, value.status) &&
    isOptionalDay(value.pausedFrom) &&
    isOptionalDay(value.pausedTo) &&
    isIsoDate(value.createdAt) &&
    (value.updatedAt === undefined || isIsoDate(value.updatedAt))
  )
}

export function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.groupId) &&
    isText(value.customerId) &&
    isDay(value.date) &&
    oneOf(ATTENDANCE_STATUSES, value.status) &&
    isOptionalString(value.note) &&
    isOptionalString(value.markedBy) &&
    isIsoDate(value.updatedAt)
  )
}

export function isLessonException(value: unknown): value is LessonException {
  return isRecord(value) && isText(value.id) && isText(value.groupId) && isDay(value.date) && typeof value.reason === 'string'
}

// Har bir maydon alohida tekshiriladi: noto'g'ri maydon standart qiymat bilan almashtiriladi
// Eski (v1–v5) sozlamalardagi `courses` maydoni bu yerda e'tiborga olinmaydi — u migrateCourses'da kurslarga aylanadi
export function sanitizeSettings(value: unknown): Settings {
  const raw = isRecord(value) ? value : {}
  return {
    orgName: isText(raw.orgName) ? raw.orgName : DEFAULT_SETTINGS.orgName,
    logoText: typeof raw.logoText === 'string' ? raw.logoText.slice(0, 3) : DEFAULT_SETTINGS.logoText,
    // v8: logotip rasmi; noto'g'ri yoki juda katta bo'lsa olib tashlanadi (harfli logo qoladi)
    logoImage: typeof raw.logoImage === 'string' && isLogoDataUrl(raw.logoImage) ? raw.logoImage : '',
    phone: typeof raw.phone === 'string' ? raw.phone : DEFAULT_SETTINGS.phone,
    address: typeof raw.address === 'string' ? raw.address : DEFAULT_SETTINGS.address,
    currency: oneOf(CURRENCIES, raw.currency) ? raw.currency : DEFAULT_SETTINGS.currency,
    dateFormat: oneOf(DATE_FORMATS, raw.dateFormat) ? raw.dateFormat : DEFAULT_SETTINGS.dateFormat,
    csvDelimiter: oneOf(DELIMITERS, raw.csvDelimiter) ? raw.csvDelimiter : DEFAULT_SETTINGS.csvDelimiter,
    adminLogin: isText(raw.adminLogin) ? raw.adminLogin : DEFAULT_SETTINGS.adminLogin,
    // v4: profil maydonlari (eski sozlamalarda yo'q — standart qiymat)
    profileName: typeof raw.profileName === 'string' ? raw.profileName.trim().slice(0, 60) : DEFAULT_SETTINGS.profileName,
    profileRole: isText(raw.profileRole) ? raw.profileRole.trim().slice(0, 40) : DEFAULT_SETTINGS.profileRole,
    // v11: davomat, qarz va eslatma sozlamalari (eski sozlamalarda yo'q — standart qiymat)
    attendanceEditDays: isWholeNumber(raw.attendanceEditDays, 0, 60) ? raw.attendanceEditDays : DEFAULT_SETTINGS.attendanceEditDays,
    prorateFirstMonth: typeof raw.prorateFirstMonth === 'boolean' ? raw.prorateFirstMonth : DEFAULT_SETTINGS.prorateFirstMonth,
    paymentDueDay: isWholeNumber(raw.paymentDueDay, 1, 28) ? raw.paymentDueDay : DEFAULT_SETTINGS.paymentDueDay,
    reminderTemplateUz: isText(raw.reminderTemplateUz) ? raw.reminderTemplateUz.slice(0, 1000) : DEFAULT_REMINDER_UZ,
    reminderTemplateRu: isText(raw.reminderTemplateRu) ? raw.reminderTemplateRu.slice(0, 1000) : DEFAULT_REMINDER_RU,
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
