import { describe, expect, it } from 'vitest'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { computeDebts, currentMonth, customerDebt, pendingPayments, studyMonthNumber, totalDebt } from './debts'

// 2026-yil 15-noyabr
const NOW = new Date(2026, 10, 15, 12)
const at = (m: number, d: number) => new Date(2026, m, d, 12).toISOString()

const courses: Course[] = [
  { id: 'k1', name: 'IELTS', type: 'course', durationMonths: 6, monthlyPrice: 650_000, activeGroups: 1, status: 'active', createdAt: at(0, 1) },
  { id: 'k2', name: 'Python', type: 'course', durationMonths: 4, monthlyPrice: 900_000, activeGroups: 1, status: 'archived', createdAt: at(0, 1) },
  { id: 'k3', name: 'Bepul', type: 'service', durationMonths: 1, monthlyPrice: 0, activeGroups: 0, status: 'active', createdAt: at(0, 1) },
]

const customer = (id: string, patch: Partial<Customer> = {}): Customer => ({
  id,
  name: `Mijoz ${id}`,
  phone: '+998 90 000 00 00',
  course: 'IELTS',
  status: 'paid',
  source: 'instagram',
  createdAt: at(0, 1),
  ...patch,
})

const pay = (customerId: string, amount: number, date: string, patch: Partial<Transaction> = {}): Transaction => ({
  id: `${customerId}-${amount}-${date}-${patch.status ?? 'paid'}`,
  type: 'income',
  amount,
  method: 'cash',
  category: 'course_fee',
  note: '',
  customerId,
  status: 'paid',
  date,
  ...patch,
})

describe('qarzdorlik qoidasi', () => {
  it('kutilgan = kurs oylik narxi, to\'langan = shu oydagi "To\'langan" kirimlar, qarz = farq', () => {
    const tx = [
      pay('a', 200_000, at(10, 2)),
      pay('a', 100_000, at(10, 14)),
      pay('a', 650_000, at(9, 30)), // o'tgan oy — hisobga olinmaydi
      pay('a', 300_000, at(10, 10), { status: 'pending' }), // kutilmoqda — to'langan emas
      pay('a', 300_000, at(10, 10), { status: 'cancelled' }),
    ]
    expect(customerDebt(customer('a'), courses, tx, NOW)).toMatchObject({ expected: 650_000, paid: 300_000, debt: 350_000, pending: 300_000 })
  })

  it('faqat "To\'lov qildi" bosqichi; narxi 0 yoki topilmagan kurs hisoblanmaydi; arxivdagi kurs hisoblanadi', () => {
    expect(customerDebt(customer('b', { status: 'thinking' }), courses, [], NOW)).toBeNull()
    expect(customerDebt(customer('c', { course: 'Bepul' }), courses, [], NOW)).toBeNull()
    expect(customerDebt(customer('d', { course: 'Noma\'lum' }), courses, [], NOW)).toBeNull()
    expect(customerDebt(customer('e', { course: 'Python' }), courses, [], NOW)?.debt).toBe(900_000)
  })

  it('ortiqcha to\'lov manfiy qarz bermaydi', () => {
    expect(customerDebt(customer('a'), courses, [pay('a', 800_000, at(10, 1))], NOW)).toMatchObject({ debt: 0, paid: 800_000 })
  })

  it('ro\'yxat: faqat qarzdorlar, qarzi kattasidan, teng bo\'lsa ism bo\'yicha', () => {
    const list = [
      customer('a', { name: 'Bobur' }),
      customer('b', { name: 'Aziza' }),
      customer('c', { name: 'Vali', course: 'Python' }),
      customer('d', { name: 'Sardor' }),
    ]
    const rows = computeDebts(list, courses, [pay('d', 650_000, at(10, 3))], NOW)
    expect(rows.map((r) => r.customer.name)).toEqual(['Vali', 'Aziza', 'Bobur'])
    expect(totalDebt(rows)).toBe(900_000 + 650_000 * 2)
  })

  it('joriy oy chegaralari va kutilayotgan to\'lovlar ro\'yxati', () => {
    const month = currentMonth(NOW)
    expect(month.start).toEqual(new Date(2026, 10, 1))
    expect(month.end.getDate()).toBe(30)
    const pending = pendingPayments([
      pay('a', 1, at(10, 9), { status: 'pending' }),
      pay('b', 2, at(10, 2), { status: 'pending' }),
      pay('c', 3, at(10, 2)),
      { ...pay('d', 4, at(10, 1), { status: 'pending' }), type: 'expense', category: 'rent', customerId: undefined },
    ])
    expect(pending.map((t) => t.amount)).toEqual([2, 1])
  })
})

describe('kurs davomiyligi (paidAt)', () => {
  it('o\'qish oyi: "To\'lov qildi" ga o\'tgan oy — 1-oy', () => {
    expect(studyMonthNumber(customer('a', { paidAt: at(10, 3) }), NOW)).toBe(1)
    expect(studyMonthNumber(customer('a', { paidAt: at(5, 28) }), NOW)).toBe(6)
    expect(studyMonthNumber(customer('a'), NOW)).toBeNull()
  })

  it('kurs davomiyligi tugagan mijozga qarz yozilmaydi', () => {
    // IELTS — 6 oy: iyun (1-oy) ... noyabr (6-oy) — hali o'qiydi; may oyidan boshlagan — tugatgan
    expect(customerDebt(customer('a', { paidAt: at(5, 1) }), courses, [], NOW)).toMatchObject({ debt: 650_000, studyMonth: 6 })
    expect(customerDebt(customer('b', { paidAt: at(4, 30) }), courses, [], NOW)).toBeNull()
    expect(computeDebts([customer('a', { paidAt: at(5, 1) }), customer('b', { paidAt: at(4, 30) })], courses, [], NOW).map((r) => r.customer.id)).toEqual(['a'])
  })
})
