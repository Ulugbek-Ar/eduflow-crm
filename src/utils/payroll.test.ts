import { describe, expect, it } from 'vitest'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { Enrollment, Group } from '../types/group.types'
import type { Teacher } from '../types/teacher.types'
import { attributeIncome } from './attribution'
import { activeInMonth, monthBounds, payrollReport, payrollRow, payrollTotals, salaryFor, shiftPeriod } from './payroll'

const course: Course = { id: 'k1', name: 'IELTS', type: 'course', durationMonths: 6, monthlyPrice: 600_000, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
const teacherA: Teacher = { id: 'pA', name: 'A', phone: '', subjects: [], payRule: { type: 'percent', percent: 40 }, status: 'active', createdAt: '' }
const teacherB: Teacher = { id: 'pB', name: 'B', phone: '', subjects: [], payRule: { type: 'perStudent', amount: 150_000 }, status: 'active', createdAt: '' }
const teacherC: Teacher = { id: 'pC', name: 'C', phone: '', subjects: [], payRule: { type: 'fixed', amount: 5_000_000 }, status: 'active', createdAt: '' }
const group = (id: string, teacherId: string): Group => ({ id, name: id, courseId: 'k1', teacherId, room: '', days: ['mon'], startTime: '09:00', endTime: '10:00', capacity: 20, startDate: '2026-01-01', status: 'active', createdAt: '' })
const groups = [group('gA', 'pA'), group('gB', 'pB')]
const customer = (id: string): Customer => ({ id, name: id, phone: '', course: 'IELTS', status: 'paid', source: 'instagram', createdAt: '2026-01-01T00:00:00.000Z' })
const enrollment = (patch: Partial<Enrollment> & Pick<Enrollment, 'id' | 'customerId' | 'groupId'>): Enrollment => ({ startDate: '2026-09-01', status: 'active', createdAt: '', ...patch })
const pay = (id: string, customerId: string, date: string, amount: number, patch: Partial<Transaction> = {}): Transaction => ({
  id,
  type: 'income',
  amount,
  method: 'cash',
  category: 'course_fee',
  note: '',
  customerId,
  status: 'paid',
  date: `${date}T10:00:00`,
  ...patch,
})

describe('kirim qaysi guruhga tegishli', () => {
  const enrollments = [
    enrollment({ id: 'e1', customerId: 'c1', groupId: 'gA', endDate: '2026-11-14', status: 'finished' }),
    enrollment({ id: 'e2', customerId: 'c1', groupId: 'gB', startDate: '2026-11-15' }),
  ]
  const ctx = { enrollments, groups, courses: [course], customers: [customer('c1')] }

  it('enrollmentId bo\'lsa — o\'sha guruhga', () => {
    expect(attributeIncome(pay('t', 'c1', '2026-11-20', 1, { enrollmentId: 'e1' }), ctx)?.groupId).toBe('gA')
  })

  it('bo\'lmasa — to\'lov sanasidagi shu kurs bo\'yicha faol o\'qishga (oy o\'rtasida guruh almashgan)', () => {
    expect(attributeIncome(pay('t', 'c1', '2026-11-10', 1), ctx)?.groupId).toBe('gA')
    expect(attributeIncome(pay('t', 'c1', '2026-11-20', 1), ctx)?.groupId).toBe('gB')
  })

  it('faol o\'qish topilmasa yoki kurs boshqa bo\'lsa — hech qayerga hisoblanmaydi', () => {
    expect(attributeIncome(pay('t', 'c1', '2026-08-01', 1), ctx)).toBeNull()
    expect(attributeIncome(pay('t', 'c1', '2026-11-10', 1), { ...ctx, customers: [{ ...customer('c1'), course: 'Python' }] })).toBeNull()
    expect(attributeIncome(pay('t', 'c9', '2026-11-10', 1), ctx)).toBeNull()
  })
})

describe('o\'qituvchi maoshi', () => {
  const customers = ['c1', 'c2', 'c3', 'c4'].map(customer)
  const enrollments = [
    // c1: 15-noyabrda A guruhidan B guruhiga o'tgan
    enrollment({ id: 'e1', customerId: 'c1', groupId: 'gA', endDate: '2026-11-14', status: 'finished' }),
    enrollment({ id: 'e2', customerId: 'c1', groupId: 'gB', startDate: '2026-11-15' }),
    // c2: B guruhida, butun noyabr pauzada
    enrollment({ id: 'e3', customerId: 'c2', groupId: 'gB', status: 'paused', pausedFrom: '2026-11-01', pausedTo: '2026-11-30' }),
    // c3: A guruhida, 20% chegirma bilan to'laydi
    enrollment({ id: 'e4', customerId: 'c3', groupId: 'gA', discountPercent: 20 }),
    // c4: B guruhida, oy oxirida keldi
    enrollment({ id: 'e5', customerId: 'c4', groupId: 'gB', startDate: '2026-11-28' }),
  ]
  const transactions: Transaction[] = [
    pay('t1', 'c1', '2026-11-03', 600_000), // A (o'tishdan oldin)
    pay('t2', 'c3', '2026-11-05', 480_000), // A (chegirma bilan)
    pay('t3', 'c1', '2026-11-20', 300_000), // B (o'tgandan keyin, enrollmentId siz)
    pay('t4', 'c3', '2026-10-30', 480_000), // oktyabr — noyabrga kirmaydi
    pay('t5', 'c4', '2026-11-28', 600_000, { status: 'pending' }), // kutilmoqda — kirmaydi
    { ...pay('t6', '', '2026-11-25', 2_000_000), type: 'expense', category: 'salary', customerId: undefined, teacherId: 'pA', period: '2026-11' },
    { ...pay('t7', '', '2026-11-05', 1_000_000), type: 'expense', category: 'salary', customerId: undefined, teacherId: 'pA', period: '2026-10' },
  ]
  const ctx = { teachers: [teacherA, teacherB, teacherC], groups, enrollments, transactions, courses: [course], customers }

  it('foiz: o\'z guruhlaridan yig\'ilgan "To\'langan" kirim × foiz; to\'langan va qolgan', () => {
    const row = payrollRow(teacherA, '2026-11', ctx)
    expect(row.revenue).toBe(600_000 + 480_000)
    expect(row.salary).toBe(432_000)
    // Faqat noyabr uchun (period) to'langani
    expect(row.paid).toBe(2_000_000)
    expect(row.remaining).toBe(0)
    expect(row.activeStudents).toBe(2)
  })

  it('har o\'quvchi uchun: pauzadagi hisoblanmaydi, oy o\'rtasida kelgan va o\'tgan — hisoblanadi', () => {
    const row = payrollRow(teacherB, '2026-11', ctx)
    expect(row.activeStudents).toBe(2) // c1 (15-dan), c4 (28-dan); c2 — pauzada
    expect(row.salary).toBe(300_000)
    expect(row.revenue).toBe(300_000)
    expect(row.remaining).toBe(300_000)
  })

  it('belgilangan oylik; hisobot va jamilar', () => {
    expect(payrollRow(teacherC, '2026-11', ctx).salary).toBe(5_000_000)
    const rows = payrollReport('2026-11', ctx)
    expect(rows.map((r) => r.teacher.id)).toEqual(['pA', 'pB', 'pC'])
    expect(payrollTotals(rows)).toEqual({ revenue: 1_380_000, salary: 432_000 + 300_000 + 5_000_000, paid: 2_000_000, remaining: 300_000 + 5_000_000 })
  })

  it('yordamchilar', () => {
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12')
    expect(salaryFor({ type: 'percent', percent: 33.3 }, 1_000_000, 0)).toBe(333_000)
    expect(activeInMonth(enrollment({ id: 'x', customerId: 'c', groupId: 'g', status: 'left' }), '2026-11-01', '2026-11-30')).toBe(false)
    expect(activeInMonth(enrollment({ id: 'x', customerId: 'c', groupId: 'g', status: 'paused', pausedFrom: '2026-11-10', pausedTo: '2026-12-31' }), '2026-11-01', '2026-11-30')).toBe(true)
  })
})
