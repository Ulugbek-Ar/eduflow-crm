// Server (Edge Function'lar) uchun hisob: ilova bilan aynan bir xil qarz qoidalari (src/utils/debts.ts) va eslatma matni.
// `npm run build:engine` -> supabase/functions/_shared/generated/engine.js (Deno shu yig'mani import qiladi).
// Faqat sof funksiyalar: brauzer API'lari, React va tarjima lug'ati yig'maga kirmaydi (vite.engine.config.ts)
import { rowToCourse, rowToCustomer, rowToEnrollment, rowToGroup, rowToTransaction } from '../data/mappers'
import type { Row } from '../data/mappers'
import { computeDebts } from '../utils/debts'
import { formatNumber } from '../utils/format'
import { sanitizeSettings } from '../utils/guards'
import { paymentLink } from '../utils/paymentLinks'
import { fillTemplate, monthName, withPaymentLink } from '../utils/reminders'

export interface OrgRows {
  settings: unknown
  customers: Row[]
  courses: Row[]
  transactions: Row[]
  groups: Row[]
  enrollments: Row[]
}

export interface DebtorReminder {
  customerId: string
  name: string
  phone: string
  debt: number
  label: string
  text: string
}

const alive = (rows: Row[]) => rows.filter((r) => !r.deleted_at)

function money(amount: number, currency: string, lang: 'uz' | 'ru'): string {
  if (currency === 'USD') return `$${formatNumber(amount)}`
  return `${formatNumber(amount)} ${lang === 'ru' ? 'сум' : 'so\'m'}`
}

// Qarzdorlar va ularga eslatma matni (Sozlamalardagi shablon; onlayn to'lov ulangan bo'lsa — havola bilan).
// now — markaz vaqti (Toshkent): server UTC'da ishlaydi, chaqiruvchi tashkentNow() bilan beradi
export function debtorReminders(rows: OrgRows, options: { now: Date; lang: 'uz' | 'ru'; withLink: boolean }): DebtorReminder[] {
  const settings = sanitizeSettings(rows.settings)
  const customers = alive(rows.customers).map(rowToCustomer)
  const ids = new Set(customers.map((c) => c.id))
  const debts = computeDebts(customers, alive(rows.courses).map(rowToCourse), alive(rows.transactions).map(rowToTransaction), options.now, {
    groups: alive(rows.groups).map(rowToGroup),
    enrollments: alive(rows.enrollments)
      .map(rowToEnrollment)
      .filter((e) => ids.has(e.customerId)),
    settings: { prorateFirstMonth: settings.prorateFirstMonth, paymentDueDay: settings.paymentDueDay },
  })
  const template = options.lang === 'ru' ? settings.reminderTemplateRu : settings.reminderTemplateUz
  return debts.map((row) => {
    const link = options.withLink ? paymentLink(settings, row.customer.phone, row.debt, options.lang) : null
    const text = fillTemplate(template, {
      ism: row.customer.name,
      summa: money(row.debt, settings.currency, options.lang),
      kurs: row.course.name,
      guruh: row.label,
      oy: monthName(options.now, options.lang),
      markaz: settings.orgName,
      telefon: settings.phone,
      havola: link ?? '',
    })
    return {
      customerId: row.customer.id,
      name: row.customer.name,
      phone: row.customer.phone,
      debt: row.debt,
      label: row.label,
      text: withPaymentLink(template, text, link, options.lang, true),
    }
  })
}

// Server UTC'da ishlaydi: Toshkent vaqtidagi "hozir" (getDate/getMonth Toshkent sanasini beradi)
export function tashkentNow(utcMs: number): Date {
  return new Date(utcMs + 5 * 3_600_000)
}
