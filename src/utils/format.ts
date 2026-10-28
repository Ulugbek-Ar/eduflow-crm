import type { Currency, DateRange } from '../types/dashboard.types'

const numberFormat = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 })
const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatMoney(amount: number, currency: Currency): string {
  return currency === 'USD' ? usdFormat.format(amount) : `${numberFormat.format(amount)} so'm`
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

// Tanlangan davrning boshlanish vaqti
export function getRangeStart(range: DateRange, now = new Date()): Date {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  switch (range) {
    case 'today':
      return start
    case '7d':
      start.setDate(start.getDate() - 6)
      return start
    case 'month':
      start.setDate(1)
      return start
    case 'year':
      start.setMonth(0, 1)
      return start
  }
}

export function isInRange(iso: string, range: DateRange): boolean {
  return new Date(iso).getTime() >= getRangeStart(range).getTime()
}

// Sana -> <input type="date"> qiymati (mahalliy vaqt bo'yicha 'YYYY-MM-DD')
export function toInputDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function todayInputValue(): string {
  return toInputDate(new Date())
}

// Summa maydoni: faqat raqamlar, minglik ajratgich bilan "1 200 000"
export function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function parseAmount(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function createId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
