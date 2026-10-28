import type { Currency, DateFormat } from '../types/dashboard.types'

const numberFormat = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 1 })
const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatMoney(amount: number, currency: Currency): string {
  return currency === 'USD' ? usdFormat.format(amount) : `${numberFormat.format(amount)} so'm`
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

const percentFormat = new Intl.NumberFormat('uz-UZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function formatPercent(value: number): string {
  return `${percentFormat.format(value)}%`
}

// Qisqa ko'rinish: 1 500 000 -> "1,5 mln", 650 000 -> "650 ming"
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}${trimZero(abs / 1_000_000_000)} mlrd`
  if (abs >= 1_000_000) return `${sign}${trimZero(abs / 1_000_000)} mln`
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} ming`
  return `${sign}${abs}`
}

function trimZero(value: number): string {
  return decimalFormat.format(Math.round(value * 10) / 10)
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

// Sozlamadagi formatga ko'ra, mahalliy vaqt bo'yicha (brauzer lokaliga bog'liq emas)
export function formatDateWith(iso: string, format: DateFormat): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  switch (format) {
    case 'dd.mm.yyyy':
      return `${dd}.${mm}.${yyyy}`
    case 'dd/mm/yyyy':
      return `${dd}/${mm}/${yyyy}`
    case 'yyyy-mm-dd':
      return `${yyyy}-${mm}-${dd}`
  }
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
