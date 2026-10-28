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
