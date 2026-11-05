import type { Currency, DateFormat } from '../types/dashboard.types'

// Raqamlar brauzer lokaliga bog'liq emas: ba'zi brauzerlarda uz-UZ "2,150,000" beradi, O'zbekistonda esa
// odatiy yozuv "2 150 000" (bo'linmaydigan bo'shliq bilan) va kasr vergul bilan: "12,5"
const GROUP = '\u00a0'

function groupDigits(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP)
}

// Butun son, minglik ajratgich bilan: -380000 -> "-380 000"
export function formatNumber(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? '-' : ''
  return `${sign}${groupDigits(String(Math.abs(rounded)))}`
}

// Bitta kasr xonasi: 12.345 -> "12,3"; fixed — har doim kasr bilan (150 -> "150,0")
export function formatDecimal(value: number, fixed = false): string {
  const rounded = Math.round(value * 10) / 10
  const sign = rounded < 0 ? '-' : ''
  const [integer, fraction = '0'] = Math.abs(rounded).toFixed(1).split('.')
  const grouped = groupDigits(integer)
  return `${sign}${grouped}${fixed || fraction !== '0' ? `,${fraction}` : ''}`
}

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function formatMoney(amount: number, currency: Currency): string {
  return currency === 'USD' ? usdFormat.format(amount) : `${formatNumber(amount)} so'm`
}

export function formatPercent(value: number): string {
  return `${formatDecimal(value, true)}%`
}

// Bayt -> "12,4 KB" (band joy ko'rsatkichi uchun)
export function formatKilobytes(bytes: number): string {
  return `${formatDecimal(bytes / 1024, true)} KB`
}

// Qisqa ko'rinish: 1 500 000 -> "1,5 mln", 650 000 -> "650 ming"
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}${formatDecimal(abs / 1_000_000_000)} mlrd`
  if (abs >= 1_000_000) return `${sign}${formatDecimal(abs / 1_000_000)} mln`
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} ming`
  return `${sign}${abs}`
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
