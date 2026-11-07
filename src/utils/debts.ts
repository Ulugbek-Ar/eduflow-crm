import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Settings } from '../types/dashboard.types'
import type { Transaction } from '../types/finance.types'
import type { Enrollment, Group } from '../types/group.types'
import { inPeriod } from './analytics'
import type { Period } from './analytics'
import { incomesByEnrollment } from './attribution'
import { addDays, dayString, enrollmentMonthlyFee, parseDay } from './groups'

// ===== Qarzdorlik (v11: o'qish — enrollment — asosida) =====
//
// Qoida (README -> "Qarzdorlik"):
//   1. Har bir o'qish uchun oylik summa = (individual narx ?? kurs narxi) × (1 − chegirma%).
//   2. Oylar: o'qish boshlangan oydan joriy oygacha. endDate dan keyingi oylar hisoblanmaydi.
//      Pauza oralig'iga to'g'ri kelgan kunlar hisoblanmaydi: butun oy pauzada — 0, qisman — faol kunlar ulushida.
//   3. Birinchi oy: Sozlamalarda "kunlar bo'yicha hisoblash" yoqilgan bo'lsa — boshlangan kundan oy oxirigacha
//      ulushda, aks holda to'liq.
//   4. To'lov muddati: har oyning N-sanasi (Sozlamalar, standart 10); birinchi oy — o'qish boshlangan kun.
//      Muddati o'tmagan oy hali qarz emas ("to'lanishi kutilmoqda").
//   5. To'langan = shu o'qishga tegishli "To'langan" kirimlar (utils/attribution.ts: enrollmentId, bo'lmasa to'lov
//      sanasidagi shu kurs bo'yicha faol o'qish). "Kutilmoqda" va "Bekor qilingan" kirmaydi.
//   6. Balans = Σ to'langan − Σ muddati o'tgan kutilgan (o'qish boshidan). Manfiy — qarz, musbat — avans;
//      avans keyingi oylarga o'tadi.
//   7. O'qishi (guruhi) yo'q "To'lov qildi" mijozlar — eskicha: joriy oy uchun kurs narxi − shu oy to'langan
//      (kurs davomiyligi tugagan bo'lsa qarz yo'q).

export type DebtSettings = Pick<Settings, 'prorateFirstMonth' | 'paymentDueDay'>

export const DEFAULT_DEBT_SETTINGS: DebtSettings = { prorateFirstMonth: false, paymentDueDay: 10 }

export interface DebtContext {
  groups?: readonly Group[]
  enrollments?: readonly Enrollment[]
  settings?: DebtSettings
}

export interface LedgerMonth {
  // 'YYYY-MM'
  period: string
  expected: number
  paid: number
  // O'qish boshidan shu oy oxirigacha: Σ to'langan − Σ kutilgan
  balance: number
  // To'lov muddati o'tganmi (o'tmagan oy hali qarz emas)
  due: boolean
}

export interface EnrollmentLedger {
  enrollment: Enrollment
  group?: Group
  course?: Course
  fee: number
  months: LedgerMonth[]
  // Muddati o'tgan oylar bo'yicha kutilgan
  expectedDue: number
  // Joriy oy bilan (muddatidan qat'i nazar) kutilgan
  expectedAll: number
  paid: number
  // paid − expectedDue
  balance: number
  // Muddati o'tgan oxirgi oy ('YYYY-MM') — qarzni yopish to'lovi shu oy uchun yoziladi
  duePeriod?: string
}

export interface DebtRow {
  customer: Customer
  course: Course
  // Bitta guruh bo'lsa — o'sha guruh
  group?: Group
  // "IELTS — kechki" yoki "IELTS — kechki, Python"
  label: string
  // Oylik summa (barcha o'qishlar bo'yicha)
  monthly: number
  // Muddati o'tgan kutilgan (o'qish boshidan) va to'langan
  expected: number
  paid: number
  debt: number
  advance: number
  // Joriy oyni ham hisoblaganda to'lanishi kerak bo'lgan qoldiq (to'lov formasi uchun)
  dueNow: number
  // Shu mijozning "Kutilmoqda" statusidagi kirimlari (istalgan oy) — eslatma uchun
  pending: number
  // O'qishning nechanchi oyi (eskicha hisobda; paidAt bo'lmasa null)
  studyMonth: number | null
  ledgers: EnrollmentLedger[]
}

export function currentMonth(now = new Date()): Period {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

function sumBy(transactions: readonly Transaction[], match: (t: Transaction) => boolean): number {
  return transactions.reduce((sum, t) => sum + (match(t) ? t.amount : 0), 0)
}

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/

const daysBetween = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000) + 1

function monthOf(day: string): string {
  return day.slice(0, 7)
}

function monthStartDay(period: string): string {
  return `${period}-01`
}

function monthEndDay(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return dayString(new Date(y, m, 0))
}

function nextPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return dayString(new Date(y, m, 1)).slice(0, 7)
}

// O'qishning amaldagi tugash kuni (tugatgan/ketgan, lekin sanasi yo'q — oxirgi o'zgarish kuni)
function effectiveEnd(e: Enrollment): string | undefined {
  if (e.endDate) return e.endDate
  if (e.status === 'left' || e.status === 'finished') return (e.updatedAt ?? e.createdAt).slice(0, 10)
  return undefined
}

// Shu oy uchun kutilgan summa (pauza, tugash va birinchi oy ulushi bilan)
export function monthExpected(e: Enrollment, period: string, fee: number, settings: DebtSettings): number {
  const from = monthStartDay(period)
  const to = monthEndDay(period)
  const end = effectiveEnd(e)
  const activeFrom = e.startDate > from ? e.startDate : from
  const activeTo = end && end < to ? end : to
  if (activeFrom > activeTo || fee <= 0) return 0
  const monthDays = daysBetween(from, to)
  let activeDays = daysBetween(activeFrom, activeTo)
  const pauseFrom = e.pausedFrom ?? (e.status === 'paused' ? (e.updatedAt ?? e.createdAt).slice(0, 10) : undefined)
  let paused = false
  if (pauseFrom) {
    const pauseTo = e.pausedTo ?? '9999-12-31'
    const overlapFrom = pauseFrom > activeFrom ? pauseFrom : activeFrom
    const overlapTo = pauseTo < activeTo ? pauseTo : activeTo
    if (overlapFrom <= overlapTo) {
      paused = true
      activeDays -= daysBetween(overlapFrom, overlapTo)
    }
  }
  if (activeDays <= 0) return 0
  const firstMonth = period === monthOf(e.startDate)
  if (paused || (firstMonth && settings.prorateFirstMonth)) return Math.round((fee * activeDays) / monthDays)
  return fee
}

// Oyning to'lov muddati: birinchi oy — o'qish boshlangan kun, keyingilari — oyning N-sanasi
export function dueDate(e: Enrollment, period: string, settings: DebtSettings): string {
  if (period === monthOf(e.startDate)) return e.startDate
  const day = Math.min(28, Math.max(1, settings.paymentDueDay))
  return `${period}-${String(day).padStart(2, '0')}`
}

export function enrollmentLedger(
  e: Enrollment,
  payments: readonly Transaction[],
  ctx: { groups: readonly Group[]; courses: readonly Course[]; settings: DebtSettings },
  today: string,
): EnrollmentLedger {
  const group = ctx.groups.find((g) => g.id === e.groupId)
  const course = ctx.courses.find((c) => c.id === group?.courseId)
  const fee = enrollmentMonthlyFee(e, course)
  const months: LedgerMonth[] = []
  const end = effectiveEnd(e)
  const lastPeriod = [monthOf(today), end ? monthOf(end) : monthOf(today)].reduce((min, p) => (p < min ? p : min))
  const paidBy = new Map<string, number>()
  const firstPeriod = monthOf(e.startDate)
  for (const t of payments) {
    // Oylik jadvalda to'lov "qaysi oy uchun" bo'lsa o'sha oyga, bo'lmasa to'lov oyiga yoziladi
    const raw = t.period && PERIOD_RE.test(t.period) ? t.period : monthOf(dayString(new Date(t.date)))
    const period = raw < firstPeriod ? firstPeriod : raw
    paidBy.set(period, (paidBy.get(period) ?? 0) + t.amount)
  }
  let expectedDue = 0
  let expectedAll = 0
  let duePeriod: string | undefined
  let running = 0
  // Kelajakdagi oyga oldindan to'langanlar ham balansga kiradi (avans)
  const paid = payments.reduce((sum, t) => sum + t.amount, 0)
  for (let period = firstPeriod; period <= lastPeriod; period = nextPeriod(period)) {
    const expected = monthExpected(e, period, fee, ctx.settings)
    const monthPaid = paidBy.get(period) ?? 0
    const due = today > dueDate(e, period, ctx.settings)
    expectedAll += expected
    if (due) {
      expectedDue += expected
      duePeriod = period
    }
    running += monthPaid - expected
    months.push({ period, expected, paid: monthPaid, balance: running, due })
  }
  return { enrollment: e, group, course, fee, months, expectedDue, expectedAll, paid, balance: paid - expectedDue, duePeriod }
}

// To'lov formasi: shu o'qish bo'yicha tanlangan oy oxirigacha to'lanishi kerak bo'lgan qoldiq —
// o'qish boshidan shu oygacha Σ kutilgan − Σ to'langan (kelajakdagi oy tanlansa, o'sha oygacha hisoblanadi)
export function remainderThrough(ledger: EnrollmentLedger, period: string, settings: DebtSettings): number {
  let expected = 0
  let next = monthOf(ledger.enrollment.startDate)
  for (const m of ledger.months) {
    if (m.period > period) break
    expected += m.expected
    next = nextPeriod(m.period)
  }
  for (let p = next; p <= period; p = nextPeriod(p)) expected += monthExpected(ledger.enrollment, p, ledger.fee, settings)
  return Math.max(0, expected - ledger.paid)
}

// "To'lov qabul qilish" (qarzdorlar, mijoz kartasi): qarzi eng katta o'qish va uning muddati o'tgan oxirgi oyi —
// forma summani shu oygacha qoldiq bilan to'ldiradi. Qarz bo'lmasa — bo'sh (forma joriy oy qoldig'ini hisoblaydi).
// O'qishi yo'q (eskicha) mijozda — qarz summasi
export function paymentPreset(row: DebtRow | null): { enrollmentId?: string; period?: string; amount?: number } {
  if (!row) return {}
  if (row.ledgers.length === 0) return row.debt > 0 ? { amount: row.debt } : {}
  const worst = row.ledgers.filter((l) => l.balance < 0).sort((a, b) => a.balance - b.balance)[0]
  return worst ? { enrollmentId: worst.enrollment.id, period: worst.duePeriod } : {}
}

// ===== Eskicha hisob (guruhi yo'q mijozlar) =====

// Joriy oy o'qishning nechanchi oyi (paidAt oyi = 1); paidAt bo'lmasa null
export function studyMonthNumber(customer: Customer, now = new Date()): number | null {
  if (!customer.paidAt) return null
  const start = new Date(customer.paidAt)
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
}

function legacyDebt(customer: Customer, courses: readonly Course[], transactions: readonly Transaction[], now: Date): DebtRow | null {
  if (customer.status !== 'paid') return null
  const course = courses.find((c) => c.name === customer.course)
  if (!course || course.monthlyPrice <= 0) return null
  const studyMonth = studyMonthNumber(customer, now)
  if (course.durationMonths > 0 && studyMonth !== null && studyMonth > course.durationMonths) return null
  const month = currentMonth(now)
  const own = transactions.filter((t) => t.type === 'income' && t.customerId === customer.id)
  const paid = sumBy(own, (t) => t.status === 'paid' && inPeriod(t.date, month))
  const pending = sumBy(own, (t) => t.status === 'pending')
  const expected = course.monthlyPrice
  const debt = Math.max(0, expected - paid)
  return {
    customer,
    course,
    label: course.name,
    monthly: expected,
    expected,
    paid,
    debt,
    advance: Math.max(0, paid - expected),
    dueNow: debt,
    pending,
    studyMonth,
    ledgers: [],
  }
}

// ===== Umumiy API =====

interface Prepared {
  groups: readonly Group[]
  enrollments: readonly Enrollment[]
  settings: DebtSettings
  byEnrollment: Map<string, Transaction[]>
}

function prepare(customers: readonly Customer[], courses: readonly Course[], transactions: readonly Transaction[], ctx: DebtContext): Prepared {
  const groups = ctx.groups ?? []
  const enrollments = ctx.enrollments ?? []
  return {
    groups,
    enrollments,
    settings: ctx.settings ?? DEFAULT_DEBT_SETTINGS,
    byEnrollment: enrollments.length ? incomesByEnrollment(transactions, { enrollments, groups, courses, customers }) : new Map(),
  }
}

function rowFor(customer: Customer, courses: readonly Course[], transactions: readonly Transaction[], p: Prepared, now: Date): DebtRow | null {
  const own = p.enrollments.filter((e) => e.customerId === customer.id)
  if (own.length === 0) return legacyDebt(customer, courses, transactions, now)
  const today = dayString(now)
  const ledgers = own
    .map((e) => enrollmentLedger(e, p.byEnrollment.get(e.id) ?? [], { groups: p.groups, courses, settings: p.settings }, today))
    .filter((l) => l.months.length > 0 || l.paid > 0)
  if (ledgers.length === 0) return null
  const expected = ledgers.reduce((s, l) => s + l.expectedDue, 0)
  const paid = ledgers.reduce((s, l) => s + l.paid, 0)
  const all = ledgers.reduce((s, l) => s + l.expectedAll, 0)
  const balance = paid - expected
  const active = ledgers.filter((l) => !effectiveEnd(l.enrollment) || (effectiveEnd(l.enrollment) ?? '') >= addDays(today, -31))
  const main = active[0] ?? ledgers[0]
  const course = main.course ?? courses.find((c) => c.name === customer.course) ?? { id: '', name: customer.course, type: 'course', durationMonths: 0, monthlyPrice: 0, status: 'active', createdAt: customer.createdAt }
  const pending = sumBy(transactions, (t) => t.type === 'income' && t.customerId === customer.id && t.status === 'pending')
  const names = [...new Set(ledgers.map((l) => l.group?.name ?? l.course?.name ?? '—'))]
  return {
    customer,
    course,
    group: ledgers.length === 1 ? main.group : undefined,
    label: names.join(', '),
    monthly: active.reduce((s, l) => s + l.fee, 0),
    expected,
    paid,
    debt: Math.max(0, -balance),
    advance: Math.max(0, balance),
    dueNow: Math.max(0, all - paid),
    pending,
    studyMonth: null,
    ledgers,
  }
}

// Bitta mijoz (karta, chek): qarzi bo'lmasa ham satr qaytadi; hisoblab bo'lmasa — null
export function customerDebt(
  customer: Customer,
  courses: readonly Course[],
  transactions: readonly Transaction[],
  now = new Date(),
  ctx: DebtContext = {},
): DebtRow | null {
  const own = (ctx.enrollments ?? []).filter((e) => e.customerId === customer.id)
  const relevant = own.length ? transactions.filter((t) => t.customerId === customer.id) : transactions
  return rowFor(customer, courses, relevant, prepare([customer], courses, relevant, { ...ctx, enrollments: own }), now)
}

export function computeDebts(
  customers: readonly Customer[],
  courses: readonly Course[],
  transactions: readonly Transaction[],
  now = new Date(),
  ctx: DebtContext = {},
): DebtRow[] {
  const p = prepare(customers, courses, transactions, ctx)
  return customers
    .map((c) => rowFor(c, courses, transactions, p, now))
    .filter((row): row is DebtRow => row !== null && row.debt > 0)
    .sort((a, b) => b.debt - a.debt || a.customer.name.localeCompare(b.customer.name))
}

// Mijoz kartasi: oxirgi 12 oy (barcha o'qishlar bo'yicha) — kutilgan, to'langan, balans (o'qish boshidan)
export function last12Months(row: DebtRow, now = new Date()): LedgerMonth[] {
  const periods: string[] = []
  for (let i = 11; i >= 0; i--) periods.push(dayString(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7))
  return periods
    .map((period) => {
      let expected = 0
      let paid = 0
      let balance = 0
      let due = true
      for (const l of row.ledgers) {
        const month = l.months.find((m) => m.period === period)
        expected += month?.expected ?? 0
        paid += month?.paid ?? 0
        if (month && month.expected > 0 && !month.due) due = false
        const upTo = [...l.months].reverse().find((m) => m.period <= period)
        balance += upTo?.balance ?? 0
      }
      return { period, expected, paid, balance, due }
    })
    .filter((m) => m.expected > 0 || m.paid > 0 || m.balance !== 0)
}

// "Kutilmoqda" statusidagi kirimlar — eng eskisi birinchi
export function pendingPayments(transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'income' && t.status === 'pending').sort((a, b) => a.date.localeCompare(b.date))
}

export function totalDebt(rows: readonly DebtRow[]): number {
  return rows.reduce((sum, r) => sum + r.debt, 0)
}
