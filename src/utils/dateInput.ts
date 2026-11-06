import { tr } from '../i18n'
import type { DateFormat } from '../types/dashboard.types'

// Sana maydoni uchun: foydalanuvchi sozlamadagi formatda yozadi ("15.11.2026"), ichkarida 'YYYY-MM-DD' saqlanadi.
// Brauzerning <input type="date"> ko'rinishi tilga bog'liq ("mm/dd/yyyy") — shu sababli o'z maydonimiz

interface FormatSpec {
  separator: string
  // Qismlar tartibi: kun, oy, yil
  order: Array<'d' | 'm' | 'y'>
}

const SPECS: Record<DateFormat, FormatSpec> = {
  'dd.mm.yyyy': { separator: '.', order: ['d', 'm', 'y'] },
  'dd/mm/yyyy': { separator: '/', order: ['d', 'm', 'y'] },
  'yyyy-mm-dd': { separator: '-', order: ['y', 'm', 'd'] },
}

const LENGTH = { d: 2, m: 2, y: 4 } as const

// Maydon ichidagi ko'rsatma: "kk.oo.yyyy"
export function datePlaceholder(format: DateFormat): string {
  const { separator, order } = SPECS[format]
  const names = { d: tr('kk'), m: tr('oo'), y: tr('yyyy') }
  return order.map((part) => names[part]).join(separator)
}

// Faqat raqamlar qoldiriladi va ajratgichlar o'zi qo'yiladi: "15112026" -> "15.11.2026"
export function maskDate(text: string, format: DateFormat): string {
  const { separator, order } = SPECS[format]
  const digits = text.replace(/\D/g, '').slice(0, 8)
  const parts: string[] = []
  let rest = digits
  for (const part of order) {
    if (!rest) break
    parts.push(rest.slice(0, LENGTH[part]))
    rest = rest.slice(LENGTH[part])
  }
  return parts.join(separator)
}

// To'liq va haqiqiy sana bo'lsa 'YYYY-MM-DD', aks holda null (31.02 kabi sanalar rad etiladi)
export function parseDisplayDate(text: string, format: DateFormat): string | null {
  const { separator, order } = SPECS[format]
  const parts = text.split(separator)
  if (parts.length !== 3) return null
  const values: Record<'d' | 'm' | 'y', string> = { d: '', m: '', y: '' }
  order.forEach((part, index) => {
    values[part] = parts[index]
  })
  if (values.d.length !== 2 || values.m.length !== 2 || values.y.length !== 4) return null
  const day = Number(values.d)
  const month = Number(values.m)
  const year = Number(values.y)
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day > daysInMonth) return null
  return `${values.y}-${values.m}-${values.d}`
}

// 'YYYY-MM-DD' -> sozlamadagi ko'rinish; bo'sh qiymat — bo'sh satr
export function toDisplayDate(value: string, format: DateFormat): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ''
  const [, y, m, d] = match
  const { separator, order } = SPECS[format]
  const values = { d, m, y }
  return order.map((part) => values[part]).join(separator)
}
