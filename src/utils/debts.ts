import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { inPeriod } from './analytics'
import type { Period } from './analytics'

// ===== Qarzdorlik hisobi (joriy kalendar oyi) =====
//
// Qoida:
//   1. Faqat "To'lov qildi" bosqichidagi mijozlar hisoblanadi (boshqa bosqichlar hali/endi o'quvchi emas).
//   2. Kutilgan summa = mijoz kursining oylik narxi. Kurs topilmasa yoki narxi 0 bo'lsa — mijoz hisobga
//      olinmaydi (narx kiritilmagan kursdan qarz chiqarib bo'lmaydi). Arxivdagi kurs ham hisoblanadi.
//   2a. Kurs davomiyligi tugagan bo'lsa qarz yo'q: "To'lov qildi" ga o'tgan oy (paidAt) 1-oy hisoblanadi,
//      joriy oy durationMonths-oydan keyin bo'lsa — mijoz kursni tugatgan.
//   3. To'langan = shu mijozning joriy oydagi "To'langan" statusli kirimlari yig'indisi
//      (kategoriyadan qat'i nazar). "Kutilmoqda" va "Bekor qilingan" to'langanga kirmaydi.
//   4. Qarz = max(0, kutilgan − to'langan). Ortiqcha to'lov keyingi oyga o'tkazilmaydi.
//   5. Ro'yxatda faqat qarzi > 0 bo'lganlar, qarzi kattasidan; teng bo'lsa ism bo'yicha.

export interface DebtRow {
  customer: Customer
  course: Course
  expected: number
  paid: number
  debt: number
  // Shu mijozning "Kutilmoqda" statusidagi kirimlari (istalgan oy) — eslatma uchun
  pending: number
  // O'qishning nechanchi oyi (paidAt bo'lmasa null)
  studyMonth: number | null
}

export function currentMonth(now = new Date()): Period {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

function sumBy(transactions: readonly Transaction[], match: (t: Transaction) => boolean): number {
  return transactions.reduce((sum, t) => sum + (match(t) ? t.amount : 0), 0)
}

export function customerDebt(
  customer: Customer,
  courses: readonly Course[],
  transactions: readonly Transaction[],
  now = new Date(),
): DebtRow | null {
  if (customer.status !== 'paid') return null
  const course = courses.find((c) => c.name === customer.course)
  if (!course || course.monthlyPrice <= 0) return null
  const studyMonth = studyMonthNumber(customer, now)
  if (studyMonth !== null && studyMonth > course.durationMonths) return null
  const month = currentMonth(now)
  const own = transactions.filter((t) => t.type === 'income' && t.customerId === customer.id)
  const paid = sumBy(own, (t) => t.status === 'paid' && inPeriod(t.date, month))
  const pending = sumBy(own, (t) => t.status === 'pending')
  const expected = course.monthlyPrice
  return { customer, course, expected, paid, debt: Math.max(0, expected - paid), pending, studyMonth }
}

// Joriy oy o'qishning nechanchi oyi (paidAt oyi = 1); paidAt bo'lmasa null
export function studyMonthNumber(customer: Customer, now = new Date()): number | null {
  if (!customer.paidAt) return null
  const start = new Date(customer.paidAt)
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
}

export function computeDebts(
  customers: readonly Customer[],
  courses: readonly Course[],
  transactions: readonly Transaction[],
  now = new Date(),
): DebtRow[] {
  return customers
    .map((c) => customerDebt(c, courses, transactions, now))
    .filter((row): row is DebtRow => row !== null && row.debt > 0)
    .sort((a, b) => b.debt - a.debt || a.customer.name.localeCompare(b.customer.name))
}

// "Kutilmoqda" statusidagi kirimlar — eng eskisi birinchi
export function pendingPayments(transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'income' && t.status === 'pending').sort((a, b) => a.date.localeCompare(b.date))
}

export function totalDebt(rows: readonly DebtRow[]): number {
  return rows.reduce((sum, r) => sum + r.debt, 0)
}
