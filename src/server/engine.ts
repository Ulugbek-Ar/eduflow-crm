// Server (Edge Function'lar) uchun hisob: ilova bilan aynan bir xil qarz qoidalari (src/utils/debts.ts) va eslatma matni.
// `npm run build:engine` -> supabase/functions/_shared/generated/engine.js (Deno shu yig'mani import qiladi).
// Faqat sof funksiyalar: brauzer API'lari, React va tarjima lug'ati yig'maga kirmaydi (vite.engine.config.ts)
import { rowToAttendance, rowToCourse, rowToCustomer, rowToEnrollment, rowToGroup, rowToTransaction } from '../data/mappers'
import { isLiveTransactionRow } from '../data/mappers'
import type { Row } from '../data/mappers'
import { attendanceRate, recordsFor, simpleStatus } from '../utils/attendance'
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
  // Davomat faqat ikki holatda (ilova bilan bir xil): eski "kechikdi" — keldi, "sababli" — kelmadi
  attendance: { present: number; absent: number; rate: number | null; recent: Array<{ date: string; status: 'present' | 'absent'; group: string }> }
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
  const debts = computeDebts(customers, alive(rows.courses).map(rowToCourse), alive(rows.transactions).filter(isLiveTransactionRow).map(rowToTransaction), options.now, {
    groups: alive(rows.groups).map(rowToGroup),
    enrollments: alive(rows.enrollments)
      .map(rowToEnrollment)
      .filter((e) => ids.has(e.customerId)),
    settings: { prorateFirstMonth: settings.prorateFirstMonth, paymentDueDay: settings.paymentDueDay },
  })
  const template = options.lang === 'ru' ? settings.reminderTemplateRu : settings.reminderTemplateUz
  return debts.map((row) => {
    const link = options.withLink ? paymentLink(settings, row.customer.phone, row.debt, options.lang, row.customer.id) : null
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
  const transactions = alive(rows.transactions).filter(isLiveTransactionRow).map(rowToTransaction)
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
    const amount = debt?.debt ?? 0
    return [
      {
        customerId: id,
        name: customer.name,
        debt: amount,
        advance: debt?.advance ?? 0,
        monthly: debt?.monthly ?? 0,
        link: amount > 0 ? paymentLink(settings, customer.phone, amount, options.lang, customer.id) : null,
        currency: settings.currency,
        groups: own.flatMap((e) => {
          const g = groups.find((x) => x.id === e.groupId)
          return g ? [{ name: g.name, days: g.days, startTime: g.startTime, endTime: g.endTime, room: g.room }] : []
        }),
        attendance: {
          present: records.filter((r) => simpleStatus(r.status) === 'present').length,
          absent: records.filter((r) => simpleStatus(r.status) === 'absent').length,
          rate: attendanceRate(records),
          recent: records.slice(0, 5).map((r) => ({ date: r.date, status: simpleStatus(r.status), group: groupName(r.groupId) })),
        },
      },
    ]
  })
}

// N-1: onlayn to'lovni o'quvchining o'qishlari bo'yicha taqsimlash — avval eng eski o'qish qarzi, keyin keyingisi;
// qoldiq (avans) — eng eski faol o'qishga. O'qish bo'lmasa — bitta bog'lanmagan qism (enrollmentId: null)
export interface PaymentPart {
  enrollmentId: string | null
  amount: number
}

function debtRowOf(rows: OrgRows, customerId: string, now: Date) {
  const settings = sanitizeSettings(rows.settings)
  const customer = alive(rows.customers).map(rowToCustomer).find((c) => c.id === customerId)
  if (!customer) return null
  const enrollments = alive(rows.enrollments).map(rowToEnrollment).filter((e) => e.customerId === customerId)
  return customerDebt(customer, alive(rows.courses).map(rowToCourse), alive(rows.transactions).filter(isLiveTransactionRow).map(rowToTransaction), now, {
    groups: alive(rows.groups).map(rowToGroup),
    enrollments,
    settings: { prorateFirstMonth: settings.prorateFirstMonth, paymentDueDay: settings.paymentDueDay },
  })
}

export function allocatePayment(rows: OrgRows, customerId: string, amountSom: number, now: Date): PaymentPart[] {
  const ledgers = [...(debtRowOf(rows, customerId, now)?.ledgers ?? [])].sort(
    (a, b) => a.enrollment.startDate.localeCompare(b.enrollment.startDate) || a.enrollment.id.localeCompare(b.enrollment.id),
  )
  if (ledgers.length === 0 || amountSom <= 0) return [{ enrollmentId: null, amount: amountSom }]
  const parts = new Map<string, number>()
  let left = amountSom
  for (const l of ledgers) {
    const take = Math.min(left, Math.max(0, -l.balance))
    if (take <= 0) continue
    parts.set(l.enrollment.id, take)
    left -= take
  }
  if (left > 0) {
    const target = ledgers.find((l) => l.enrollment.status === 'active') ?? ledgers.find((l) => l.enrollment.status === 'paused') ?? ledgers[ledgers.length - 1]
    parts.set(target.enrollment.id, (parts.get(target.enrollment.id) ?? 0) + left)
  }
  return [...parts].map(([enrollmentId, amount]) => ({ enrollmentId, amount }))
}

// N-1: bitta telefonda bir nechta o'quvchi — qarzi bor yagona o'quvchi; 0 yoki 2+ bo'lsa null (to'lov bog'lanmagan yoziladi)
export function pickDebtor(rows: OrgRows, customerIds: readonly string[], now: Date): string | null {
  const debtors = customerIds.filter((id) => (debtRowOf(rows, id, now)?.debt ?? 0) > 0)
  return debtors.length === 1 ? debtors[0] : null
}

// Server UTC'da ishlaydi: Toshkent vaqtidagi "hozir" (getDate/getMonth Toshkent sanasini beradi)
export function tashkentNow(utcMs: number): Date {
  return new Date(utcMs + 5 * 3_600_000)
}
