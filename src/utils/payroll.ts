// O'qituvchi maoshi (oy bo'yicha). Formulalar (README -> "O'qituvchi maoshi"):
//   Yig'ilgan kirim   = oy ichidagi "To'langan" kirimlar, qaysi o'qishga tegishli ekani utils/attribution.ts qoidasi
//                       bo'yicha aniqlanib, o'qish guruhining o'qituvchisi shu o'qituvchi bo'lsa
//   Faol o'quvchilar  = o'qituvchi guruhlarida oy ichida kamida bir kun faol (pauzada emas) bo'lgan o'quvchilar (har biri bir marta)
//   Hisoblangan maosh = fixed: belgilangan summa; percent: yig'ilgan kirim × foiz; perStudent: faol o'quvchilar × summa
//   To'langan         = shu o'qituvchiga (teacherId) shu oy uchun (period, bo'lmasa sana oyi) "To'langan" maosh xarajatlari
//   Qolgan            = max(0, hisoblangan − to'langan)
import { tr } from '../i18n'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { Enrollment, Group } from '../types/group.types'
import type { PayRule, Teacher } from '../types/teacher.types'
import { attributeIncome } from './attribution'
import { dayString } from './groups'

export interface PayrollContext {
  teachers: readonly Teacher[]
  groups: readonly Group[]
  enrollments: readonly Enrollment[]
  transactions: readonly Transaction[]
  courses: readonly Course[]
  customers: readonly Customer[]
}

export interface PayrollRow {
  teacher: Teacher
  groups: Group[]
  activeStudents: number
  revenue: number
  salary: number
  paid: number
  remaining: number
}

// 'YYYY-MM' -> [birinchi kun, oxirgi kun] ('YYYY-MM-DD')
export function monthBounds(period: string): { from: string; to: string } {
  const [y, m] = period.split('-').map(Number)
  return { from: dayString(new Date(y, m - 1, 1)), to: dayString(new Date(y, m, 0)) }
}

export function periodOf(iso: string): string {
  return dayString(new Date(iso)).slice(0, 7)
}

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number)
  return dayString(new Date(y, m - 1 + months, 1)).slice(0, 7)
}

// O'qish oy ichida kamida bir kun faolmi (boshlangan, tugamagan, butun oy pauzada emas)
export function activeInMonth(e: Enrollment, from: string, to: string): boolean {
  if (e.startDate > to) return false
  if (e.endDate && e.endDate < from) return false
  if ((e.status === 'left' || e.status === 'finished') && !e.endDate) return false
  if (e.status === 'paused' && !e.pausedFrom) return false
  // Pauza butun faol oraliqni qoplasa — hisoblanmaydi
  if (e.pausedFrom) {
    const activeFrom = e.startDate > from ? e.startDate : from
    const activeTo = e.endDate && e.endDate < to ? e.endDate : to
    const pauseTo = e.pausedTo ?? '9999-12-31'
    if (e.pausedFrom <= activeFrom && pauseTo >= activeTo) return false
  }
  return true
}

export function salaryFor(rule: PayRule, revenue: number, activeStudents: number): number {
  if (rule.type === 'fixed') return rule.amount
  if (rule.type === 'percent') return Math.round((revenue * rule.percent) / 100)
  return activeStudents * rule.amount
}

export function payRuleLabel(rule: PayRule, money: (amount: number) => string): string {
  if (rule.type === 'fixed') return tr('Belgilangan: {0}', { 0: money(rule.amount) })
  if (rule.type === 'percent') return tr('Tushumdan {0}%', { 0: rule.percent })
  return tr('Har o\'quvchi uchun {0}', { 0: money(rule.amount) })
}

export function payrollRow(teacher: Teacher, period: string, ctx: PayrollContext): PayrollRow {
  const { from, to } = monthBounds(period)
  const groups = ctx.groups.filter((g) => g.teacherId === teacher.id)
  const groupIds = new Set(groups.map((g) => g.id))
  const own = ctx.enrollments.filter((e) => groupIds.has(e.groupId))
  const activeStudents = new Set(own.filter((e) => activeInMonth(e, from, to)).map((e) => e.customerId)).size
  const attribution = { enrollments: ctx.enrollments, groups: ctx.groups, courses: ctx.courses, customers: ctx.customers }
  let revenue = 0
  for (const t of ctx.transactions) {
    if (t.type !== 'income' || t.status !== 'paid') continue
    const day = dayString(new Date(t.date))
    if (day < from || day > to) continue
    const enrollment = attributeIncome(t, attribution)
    if (enrollment && groupIds.has(enrollment.groupId)) revenue += t.amount
  }
  const salary = salaryFor(teacher.payRule, revenue, activeStudents)
  const paid = ctx.transactions
    .filter((t) => t.type === 'expense' && t.category === 'salary' && t.status === 'paid' && t.teacherId === teacher.id && (t.period ?? periodOf(t.date)) === period)
    .reduce((sum, t) => sum + t.amount, 0)
  return { teacher, groups, activeStudents, revenue, salary, paid, remaining: Math.max(0, salary - paid) }
}

// Oy hisoboti: faol o'qituvchilar va shu oyda guruhi yoki to'lovi bo'lgan arxivdagilar
export function payrollReport(period: string, ctx: PayrollContext): PayrollRow[] {
  return ctx.teachers
    .map((teacher) => payrollRow(teacher, period, ctx))
    .filter((row) => row.teacher.status === 'active' || row.revenue > 0 || row.paid > 0)
    .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name))
}

export function payrollTotals(rows: readonly PayrollRow[]) {
  return rows.reduce(
    (sum, r) => ({ revenue: sum.revenue + r.revenue, salary: sum.salary + r.salary, paid: sum.paid + r.paid, remaining: sum.remaining + r.remaining }),
    { revenue: 0, salary: 0, paid: 0, remaining: 0 },
  )
}

// Maosh xarajati bugungi sana bilan yoziladi (kassadan bugun chiqadi); qaysi oy uchunligi period maydonida
export function salaryNote(teacher: Teacher, period: string): string {
  return tr('Maosh: {0} — {1}', { 0: teacher.name, 1: periodLabel(period) })
}

// '2026-11' -> '11.2026'
export function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return `${m}.${y}`
}
