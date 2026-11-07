import type { Course } from '../types/course.types'
import type { Customer, CustomerSource, CustomerStatus } from '../types/customer.types'
import type { DateRange } from '../types/dashboard.types'
import type { Transaction } from '../types/finance.types'
import type { Enrollment } from '../types/group.types'
import { activeStudentsOn, dayString } from './groups'

export interface Period {
  start: Date
  end: Date
}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

// Oy qo'shish/ayirish: 31-mart - 1 oy = 28/29-fevral (oy oxiriga qisiladi)
export function shiftMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const day = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() + months)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(day, lastDay))
  return result
}

function shiftDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Tanlangan davr: boshlanishidan bugun kun oxirigacha
export function getPeriod(range: DateRange, now = new Date()): Period {
  const end = endOfDay(now)
  const start = startOfDay(now)
  switch (range) {
    case 'today':
      return { start, end }
    case '7d':
      return { start: shiftDays(start, -6), end }
    case 'month':
      start.setDate(1)
      return { start, end }
    case 'year':
      start.setMonth(0, 1)
      return { start, end }
  }
}

// Oldingi teng davr: xuddi shu kalendar oralig'i bir birlik orqaga surilgan
export function getPreviousPeriod(range: DateRange, now = new Date()): Period {
  const { start, end } = getPeriod(range, now)
  switch (range) {
    case 'today':
      return { start: shiftDays(start, -1), end: shiftDays(end, -1) }
    case '7d':
      return { start: shiftDays(start, -7), end: shiftDays(end, -7) }
    case 'month':
      return { start: shiftMonths(start, -1), end: shiftMonths(end, -1) }
    case 'year':
      return { start: shiftMonths(start, -12), end: shiftMonths(end, -12) }
  }
}

// 'YYYY-MM-DD' oralig'i; bo'sh chegara cheklanmagan hisoblanadi
export function customPeriod(from: string, to: string): Period | null {
  if (!from && !to) return null
  return {
    start: from ? new Date(`${from}T00:00:00`) : new Date(0),
    end: to ? new Date(`${to}T23:59:59.999`) : new Date(8.64e15),
  }
}

export function inPeriod(iso: string, period: Period): boolean {
  const time = new Date(iso).getTime()
  return time >= period.start.getTime() && time <= period.end.getTime()
}

export function filterByPeriod<T>(items: readonly T[], getDate: (item: T) => string, period: Period): T[] {
  return items.filter((item) => inPeriod(getDate(item), period))
}

// Balans, KPI, grafiklar va hisobotlar faqat "To'langan" tranzaksiyalar bo'yicha:
// "Kutilmoqda" hali kassaga tushmagan, "Bekor qilingan" umuman hisobga olinmaydi
export function isPaid(t: Transaction): boolean {
  return t.status === 'paid'
}

export function paidOnly(transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter(isPaid)
}

export function sumIncome(transactions: readonly Transaction[]): number {
  return transactions.reduce((sum, t) => sum + (t.type === 'income' && isPaid(t) ? t.amount : 0), 0)
}

export function sumExpense(transactions: readonly Transaction[]): number {
  return transactions.reduce((sum, t) => sum + (t.type === 'expense' && isPaid(t) ? t.amount : 0), 0)
}

// Kassa balansi: barcha vaqt davomidagi to'langan kirim − to'langan chiqim
export function cashBalance(transactions: readonly Transaction[]): number {
  return sumIncome(transactions) - sumExpense(transactions)
}

export interface BreakdownRow<K extends string> {
  key: K
  total: number
  share: number
}

// Guruhlar bo'yicha yig'indi va ulush (0–100), kattasidan kichigiga
export function breakdown<K extends string>(
  transactions: readonly Transaction[],
  keys: readonly K[],
  getKey: (t: Transaction) => K,
): BreakdownRow<K>[] {
  const totals = new Map<K, number>(keys.map((k) => [k, 0]))
  for (const t of transactions) {
    if (!isPaid(t)) continue
    const key = getKey(t)
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
  }
  const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0)
  return Array.from(totals, ([key, total]) => ({ key, total, share: sum > 0 ? (total / sum) * 100 : 0 })).sort(
    (a, b) => b.total - a.total,
  )
}

// ===== KPI va trendlar =====

// Konversiya: berilgan (masalan, davrda kelgan) lidlardan "To'lov qildi" bosqichiga o'tganlar ulushi (0–100);
// lid bo'lmasa null ("—")
export function conversion(customers: readonly Customer[]): number | null {
  if (customers.length === 0) return null
  return (customers.filter((c) => c.status === 'paid').length / customers.length) * 100
}

// Oldingi davrga nisbatan o'zgarish foizi; oldingi qiymat 0 bo'lsa null ("—")
export function trend(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

// Konversiya kabi foizli ko'rsatkichlar uchun farq (foiz bandi)
export function pointChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return current - previous
}

export function payingCustomers(transactions: readonly Transaction[]): number {
  return new Set(transactions.filter((t) => t.type === 'income' && isPaid(t) && t.customerId).map((t) => t.customerId)).size
}

// Davr oxirida "To'lov qildi" bosqichidagi mijozlar: shu bosqichga o'tgan vaqt (paidAt) bo'yicha.
// Keyin bosqichdan chiqqanlar tarixi saqlanmaydi — ular hisobga kirmaydi
export function activeCustomersAt(customers: readonly Customer[], end: Date): number {
  return customers.filter((c) => c.status === 'paid' && new Date(c.paidAt ?? c.createdAt).getTime() <= end.getTime()).length
}

export interface OverviewKpis {
  // Jami tushum: davrdagi "To'langan" kirimlar
  revenue: { value: number; change: number | null }
  // Faol mijozlar: "To'lov qildi" bosqichida (davr oxiri holati)
  active: { value: number; change: number | null }
  // Yangi lidlar: davrda qo'shilgan mijozlar (istalgan bosqichda)
  newLeads: { value: number; change: number | null }
  // Konversiya: davrda kelgan lidlardan "To'lov qildi" ga o'tganlar ulushi; o'zgarish — foiz bandida
  conversion: { value: number | null; change: number | null }
}

// v11: guruhlar (enrollment) bo'lsa "Faol mijozlar" — davr oxirida guruhda o'qiyotgan, pauzada bo'lmaganlar;
// bo'lmasa — eskicha, "To'lov qildi" bosqichi bo'yicha
export function activeAt(customers: readonly Customer[], enrollments: readonly Enrollment[], end: Date): number {
  return enrollments.length > 0 ? activeStudentsOn(enrollments, dayString(end)) : activeCustomersAt(customers, end)
}

export function overviewKpis(
  customers: readonly Customer[],
  transactions: readonly Transaction[],
  range: DateRange,
  now = new Date(),
  enrollments: readonly Enrollment[] = [],
): OverviewKpis {
  const current = getPeriod(range, now)
  const previous = getPreviousPeriod(range, now)
  const txNow = filterByPeriod(transactions, (t) => t.date, current)
  const txPrev = filterByPeriod(transactions, (t) => t.date, previous)
  const leadsNow = filterByPeriod(customers, (c) => c.createdAt, current)
  const leadsPrev = filterByPeriod(customers, (c) => c.createdAt, previous)
  const revenue = sumIncome(txNow)
  const active = activeAt(customers, enrollments, current.end)
  const conversionNow = conversion(leadsNow)
  return {
    revenue: { value: revenue, change: trend(revenue, sumIncome(txPrev)) },
    active: { value: active, change: trend(active, activeAt(customers, enrollments, previous.end)) },
    newLeads: { value: leadsNow.length, change: trend(leadsNow.length, leadsPrev.length) },
    conversion: { value: conversionNow, change: pointChange(conversionNow, conversion(leadsPrev)) },
  }
}

// ===== Grafik uchun guruhlash =====

export const MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

export interface Bucket {
  key: string
  label: string
  longLabel: string
  start: Date
  end: Date
  income: number
  expense: number
}

function fillBuckets(buckets: Bucket[], transactions: readonly Transaction[]): Bucket[] {
  for (const t of transactions) {
    if (!isPaid(t)) continue
    const time = new Date(t.date).getTime()
    const bucket = buckets.find((b) => time >= b.start.getTime() && time <= b.end.getTime())
    if (!bucket) continue
    if (t.type === 'income') bucket.income += t.amount
    else bucket.expense += t.amount
  }
  return buckets
}

// Joriy oy bilan birga oxirgi `count` kalendar oyi
export function groupByMonth(transactions: readonly Transaction[], count = 6, now = new Date()): Bucket[] {
  const buckets = Array.from({ length: count }, (_, i): Bucket => {
    const start = new Date(now.getFullYear(), now.getMonth() - (count - 1) + i, 1)
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0))
    return {
      key: `${start.getFullYear()}-${start.getMonth() + 1}`,
      label: MONTHS_SHORT[start.getMonth()],
      longLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
      start,
      end,
      income: 0,
      expense: 0,
    }
  })
  return fillBuckets(buckets, transactions)
}

// Dushanbadan boshlanadigan oxirgi `count` hafta (joriy hafta bilan)
export function groupByWeek(transactions: readonly Transaction[], count = 8, now = new Date()): Bucket[] {
  const monday = startOfDay(now)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const buckets = Array.from({ length: count }, (_, i): Bucket => {
    const start = shiftDays(monday, -7 * (count - 1 - i))
    const end = endOfDay(shiftDays(start, 6))
    const startLabel = `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}`
    return {
      key: toKey(start),
      label: startLabel,
      longLabel: `${startLabel} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`,
      start,
      end,
      income: 0,
      expense: 0,
    }
  })
  return fillBuckets(buckets, transactions)
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function overlaps(bucket: Pick<Bucket, 'start' | 'end'>, period: Period): boolean {
  return bucket.start.getTime() <= period.end.getTime() && bucket.end.getTime() >= period.start.getTime()
}

// O'q uchun "chiroyli" maksimum va qadam: 0, 1 mln, 2 mln, ...
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (max <= 0) return { max: ticks, step: 1 }
  const rough = max / ticks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough) ?? 10) * magnitude
  return { max: step * Math.ceil(max / step), step }
}

// ===== Mijozlar manbasi =====

export interface SourceStat {
  source: CustomerSource
  count: number
  share: number
  conversion: number | null
}

export function sourceStats(customers: readonly Customer[], sources: readonly CustomerSource[]): SourceStat[] {
  return sources
    .map((source) => {
      const group = customers.filter((c) => c.source === source)
      return {
        source,
        count: group.length,
        share: customers.length > 0 ? (group.length / customers.length) * 100 : 0,
        conversion: conversion(group),
      }
    })
    .sort((a, b) => b.count - a.count)
}

// ===== So'nggi faoliyat =====

export type ActivityItem =
  | { kind: 'customer'; id: string; date: string; customer: Customer }
  | { kind: 'transaction'; id: string; date: string; transaction: Transaction }

export function recentActivity(customers: readonly Customer[], transactions: readonly Transaction[], limit = 5): ActivityItem[] {
  const items: ActivityItem[] = [
    ...customers.map((customer): ActivityItem => ({ kind: 'customer', id: customer.id, date: customer.createdAt, customer })),
    ...transactions.map((transaction): ActivityItem => ({ kind: 'transaction', id: transaction.id, date: transaction.date, transaction })),
  ]
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

// ===== Tahlil va hisobotlar =====

// O'rtacha chek (AOV) = davrdagi "To'langan" kirimlar summasi / shunday to'lovlar soni; to'lov bo'lmasa null
export function averageOrderValue(transactions: readonly Transaction[]): { value: number | null; count: number; total: number } {
  const paid = transactions.filter((t) => t.type === 'income' && isPaid(t))
  const total = paid.reduce((sum, t) => sum + t.amount, 0)
  return { value: paid.length > 0 ? total / paid.length : null, count: paid.length, total }
}

export interface SourcePerformance {
  source: CustomerSource
  // Davrda shu manbadan kelgan lidlar
  leads: number
  // Ulardan "To'lov qildi" bosqichidagilar
  paid: number
  // paid / leads × 100; lid bo'lmasa null
  conversion: number | null
  // Davrdagi "To'langan" marketing chiqimlari (manbasi ko'rsatilgan)
  spend: number
  // CPL = chiqim / lidlar; chiqim yoki lid 0 bo'lsa null ("—", nolga bo'linmaydi)
  cpl: number | null
  // Shu manbadan kelgan (istalgan vaqtda) mijozlarning davrdagi "To'langan" kirimlari
  revenue: number
  // ROI = (kirim − chiqim) / chiqim × 100; chiqim 0 bo'lsa null
  roi: number | null
}

export function safeRatio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

function performanceRow(source: CustomerSource, leads: number, paid: number, spend: number, revenue: number): SourcePerformance {
  const conversionRatio = safeRatio(paid, leads)
  const roiRatio = safeRatio(revenue - spend, spend)
  return {
    source,
    leads,
    paid,
    conversion: conversionRatio === null ? null : conversionRatio * 100,
    spend,
    cpl: spend > 0 ? safeRatio(spend, leads) : null,
    revenue,
    roi: roiRatio === null ? null : roiRatio * 100,
  }
}

export function sourcePerformance(
  customers: readonly Customer[],
  transactions: readonly Transaction[],
  sources: readonly CustomerSource[],
  period: Period,
): SourcePerformance[] {
  const leadsInPeriod = filterByPeriod(customers, (c) => c.createdAt, period)
  const txInPeriod = filterByPeriod(transactions, (t) => t.date, period).filter(isPaid)
  const sourceOf = new Map(customers.map((c) => [c.id, c.source]))
  return sources.map((source) => {
    const leads = leadsInPeriod.filter((c) => c.source === source)
    const spend = txInPeriod.filter((t) => t.type === 'expense' && t.category === 'marketing' && t.source === source).reduce((sum, t) => sum + t.amount, 0)
    const revenue = txInPeriod
      .filter((t) => t.type === 'income' && t.customerId !== undefined && sourceOf.get(t.customerId) === source)
      .reduce((sum, t) => sum + t.amount, 0)
    return performanceRow(source, leads.length, leads.filter((c) => c.status === 'paid').length, spend, revenue)
  })
}

// Jadvalning "Jami" qatori: yig'indilardan qayta hisoblanadi (o'rtachalarning o'rtachasi emas)
export function totalPerformance(rows: readonly SourcePerformance[]): Omit<SourcePerformance, 'source'> {
  const sum = (key: 'leads' | 'paid' | 'spend' | 'revenue') => rows.reduce((total, r) => total + r[key], 0)
  const { source: _source, ...total } = performanceRow('website', sum('leads'), sum('paid'), sum('spend'), sum('revenue'))
  return total
}

// ===== Voronka va kurslar =====

export interface FunnelRow {
  stage: CustomerStatus
  count: number
  // Davr lidlariga nisbatan ulush (0–100)
  share: number
}

// Davrda kelgan lidlar hozir qaysi bosqichda turibdi
export function funnelStats(customers: readonly Customer[], stages: readonly CustomerStatus[], period: Period): FunnelRow[] {
  const leads = filterByPeriod(customers, (c) => c.createdAt, period)
  return stages.map((stage) => {
    const count = leads.filter((c) => c.status === stage).length
    return { stage, count, share: leads.length > 0 ? (count / leads.length) * 100 : 0 }
  })
}

export interface CourseRevenueRow {
  course: Course
  // "To'lov qildi" bosqichidagi talabalar
  students: number
  // Davrda shu kurs mijozlaridan tushgan "To'langan" kirim
  revenue: number
  // Oylik kutilayotgan tushum = talabalar × oylik narx
  expectedMonthly: number
}

export function courseRevenue(customers: readonly Customer[], courses: readonly Course[], transactions: readonly Transaction[], period: Period): CourseRevenueRow[] {
  const courseOf = new Map(customers.map((c) => [c.id, c.course]))
  const income = filterByPeriod(transactions, (t) => t.date, period).filter((t) => t.type === 'income' && isPaid(t) && t.customerId)
  return courses
    .map((course) => {
      const students = customers.filter((c) => c.course === course.name && c.status === 'paid').length
      const revenue = income.filter((t) => courseOf.get(t.customerId ?? '') === course.name).reduce((sum, t) => sum + t.amount, 0)
      return { course, students, revenue, expectedMonthly: students * course.monthlyPrice }
    })
    .filter((row) => row.course.status === 'active' || row.revenue > 0 || row.students > 0)
    .sort((a, b) => b.revenue - a.revenue || b.expectedMonthly - a.expectedMonthly)
}
