import type { Customer, CustomerSource } from '../types/customer.types'
import type { DateRange } from '../types/dashboard.types'
import type { Transaction } from '../types/finance.types'

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

export function sumIncome(transactions: readonly Transaction[]): number {
  return transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : 0), 0)
}

export function sumExpense(transactions: readonly Transaction[]): number {
  return transactions.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : 0), 0)
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
    const key = getKey(t)
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
  }
  const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0)
  return Array.from(totals, ([key, total]) => ({ key, total, share: sum > 0 ? (total / sum) * 100 : 0 })).sort(
    (a, b) => b.total - a.total,
  )
}

// ===== KPI va trendlar =====

// Davrda kelgan mijozlardan lead bosqichidan o'tganlar ulushi (0–100); mijoz bo'lmasa null
export function conversion(customers: readonly Customer[]): number | null {
  if (customers.length === 0) return null
  return (customers.filter((c) => c.status !== 'lead').length / customers.length) * 100
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
  return new Set(transactions.filter((t) => t.type === 'income' && t.customerId).map((t) => t.customerId)).size
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
