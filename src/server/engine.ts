// Server (Edge Function'lar) uchun hisob: ilova bilan aynan bir xil qarz qoidalari (src/utils/debts.ts) va eslatma matni.
// `npm run build:engine` -> supabase/functions/_shared/generated/engine.js (Deno shu yig'mani import qiladi).
// Faqat sof funksiyalar: brauzer API'lari, React va tarjima lug'ati yig'maga kirmaydi (vite.engine.config.ts)
import { rowToAttendance, rowToCourse, rowToCustomer, rowToEnrollment, rowToGroup, rowToTransaction } from '../data/mappers'
import type { Row } from '../data/mappers'
import { attendanceRate, recordsFor } from '../utils/attendance'
import { computeDebts, customerDebt } from '../utils/debts'
import { addDays, dayString, enrollmentActiveOn } from '../utils/groups'
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
  // Telegram bot hisobotida (oxirgi 30 kun davomati) kerak
  attendance?: Row[]
}

export interface CustomerReport {
  customerId: string
  name: string
  debt: number
  advance: number
  monthly: number
  // Onlayn to'lov havolasi (Payme/Click ulangan va qarz bo'lsa)
  link: string | null
  currency: string
  groups: Array<{ name: string; days: string[]; startTime: string; endTime: string; room: string }>
  attendance: { present: number; late: number; absent: number; excused: number; rate: number | null; recent: Array<{ date: string; status: string; group: string }> }
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

// Telegram bot: ota-onaga bog'langan o'quvchilar bo'yicha qarz, guruhlar jadvali va oxirgi 30 kun davomati
export function customerReports(rows: OrgRows, customerIds: readonly string[], options: { now: Date; lang: 'uz' | 'ru' }): CustomerReport[] {
  const settings = sanitizeSettings(rows.settings)
  const customers = alive(rows.customers).map(rowToCustomer)
  const courses = alive(rows.courses).map(rowToCourse)
  const transactions = alive(rows.transactions).map(rowToTransaction)
  const groups = alive(rows.groups).map(rowToGroup)
  const enrollments = alive(rows.enrollments).map(rowToEnrollment)
  const attendance = (rows.attendance ?? []).map(rowToAttendance)
  const today = dayString(options.now)
  const from = addDays(today, -30)
  const ctx = { groups, enrollments, settings: { prorateFirstMonth: settings.prorateFirstMonth, paymentDueDay: settings.paymentDueDay } }
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? '—'
  return customerIds.flatMap((id) => {
    const customer = customers.find((c) => c.id === id)
    if (!customer) return []
    const debt = customerDebt(customer, courses, transactions, options.now, { ...ctx, enrollments: enrollments.filter((e) => e.customerId === id) })
    const own = enrollments.filter((e) => e.customerId === id && enrollmentActiveOn(e, today))
    const records = recordsFor(attendance, { customerId: id, from, to: today }).sort((a, b) => b.date.localeCompare(a.date))
    const count = (status: string) => records.filter((r) => r.status === status).length
    const amount = debt?.debt ?? 0
    return [
      {
        customerId: id,
        name: customer.name,
        debt: amount,
        advance: debt?.advance ?? 0,
        monthly: debt?.monthly ?? 0,
        link: amount > 0 ? paymentLink(settings, customer.phone, amount, options.lang) : null,
        currency: settings.currency,
        groups: own.flatMap((e) => {
          const g = groups.find((x) => x.id === e.groupId)
          return g ? [{ name: g.name, days: g.days, startTime: g.startTime, endTime: g.endTime, room: g.room }] : []
        }),
        attendance: {
          present: count('present'),
          late: count('late'),
          absent: count('absent'),
          excused: count('excused'),
          rate: attendanceRate(records),
          recent: records.slice(0, 5).map((r) => ({ date: r.date, status: r.status, group: groupName(r.groupId) })),
        },
      },
    ]
  })
}

// Server UTC'da ishlaydi: Toshkent vaqtidagi "hozir" (getDate/getMonth Toshkent sanasini beradi)
export function tashkentNow(utcMs: number): Date {
  return new Date(utcMs + 5 * 3_600_000)
}
