import { describe, expect, it } from 'vitest'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { DEFAULT_DEBT_SETTINGS, computeDebts, currentMonth, customerDebt, last12Months, monthExpected, pendingPayments, studyMonthNumber, totalDebt } from './debts'

// 2026-yil 15-noyabr
const NOW = new Date(2026, 10, 15, 12)
const at = (m: number, d: number) => new Date(2026, m, d, 12).toISOString()

const courses: Course[] = [
  { id: 'k1', name: 'IELTS', type: 'course', durationMonths: 6, monthlyPrice: 650_000, status: 'active', createdAt: at(0, 1) },
  { id: 'k2', name: 'Python', type: 'course', durationMonths: 4, monthlyPrice: 900_000, status: 'archived', createdAt: at(0, 1) },
  { id: 'k3', name: 'Bepul', type: 'service', durationMonths: 1, monthlyPrice: 0, status: 'active', createdAt: at(0, 1) },
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

describe('v11: o\'qish (enrollment) asosidagi qarz', () => {
  const ielts = { id: 'k1', name: 'IELTS', type: 'course' as const, durationMonths: 6, monthlyPrice: 600_000, status: 'active' as const, createdAt: '2026-01-01T00:00:00.000Z' }
  const group = { id: 'g1', name: 'IELTS — kechki', courseId: 'k1', room: '', days: ['mon' as const], startTime: '18:00', endTime: '19:30', capacity: 15, startDate: '2026-01-01', status: 'active' as const, createdAt: '' }
  const student = { id: 'c1', name: 'Aziza', phone: '+998 90 000 00 01', course: 'IELTS', status: 'paid' as const, source: 'instagram' as const, createdAt: '2026-08-20T10:00:00.000Z', paidAt: '2026-09-01T10:00:00.000Z' }
  const base = { id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-09-01', status: 'active' as const, createdAt: '2026-09-01T10:00:00.000Z' }
  const pay = (id: string, date: string, amount: number, patch: object = {}) => ({
    id,
    type: 'income' as const,
    amount,
    method: 'cash' as const,
    category: 'course_fee' as const,
    note: '',
    customerId: 'c1',
    status: 'paid' as const,
    date: `${date}T10:00:00`,
    ...patch,
  })
  const ctx = (enrollment: object = {}, settings = { prorateFirstMonth: false, paymentDueDay: 10 }) => ({ groups: [group], enrollments: [{ ...base, ...enrollment }], settings })
  const debtOn = (date: string, transactions: ReturnType<typeof pay>[], enrollment: object = {}, settings?: { prorateFirstMonth: boolean; paymentDueDay: number }) =>
    customerDebt(student, [ielts], transactions, new Date(`${date}T12:00:00`), ctx(enrollment, settings))

  it('har oy vaqtida to\'lasa — qarz yo\'q; to\'lov muddati o\'tmagan oy hali qarz emas', () => {
    const paid = [pay('t1', '2026-09-01', 600_000), pay('t2', '2026-10-05', 600_000)]
    expect(debtOn('2026-11-07', paid)?.debt).toBe(0)
    // 11-noyabrdan (muddat — 10-sana) noyabr oyi ham qarz
    const late = debtOn('2026-11-11', paid)
    expect(late?.debt).toBe(600_000)
    expect(late?.expected).toBe(1_800_000)
    // To'lov formasi uchun: joriy oy bilan qoldiq (muddatidan qat'i nazar)
    expect(debtOn('2026-11-07', paid)?.dueNow).toBe(600_000)
  })

  it('ortiqcha to\'lov — avans, keyingi oyga o\'tadi', () => {
    const row = debtOn('2026-11-15', [pay('t1', '2026-09-01', 1_200_000), pay('t2', '2026-10-03', 900_000)])
    expect(row?.debt).toBe(0)
    expect(row?.advance).toBe(300_000)
  })

  it('chegirma va individual narx', () => {
    expect(debtOn('2026-09-20', [], { discountPercent: 25 })?.debt).toBe(450_000)
    expect(debtOn('2026-09-20', [], { priceOverride: 500_000, discountPercent: 10 })?.debt).toBe(450_000)
  })

  it('pauza oylari hisoblanmaydi, qisman pauza — faol kunlar ulushida', () => {
    const paid = [pay('t1', '2026-09-01', 600_000)]
    // Butun oktyabr pauzada — oktyabr kutilmaydi
    expect(debtOn('2026-10-25', paid, { status: 'paused', pausedFrom: '2026-10-01', pausedTo: '2026-10-31' })?.debt).toBe(0)
    // Noyabr 16–30 pauza: 15/30 kun faol -> 300 000
    const partial = debtOn('2026-11-20', [...paid, pay('t2', '2026-10-05', 600_000)], { pausedFrom: '2026-11-16', pausedTo: '2026-11-30' })
    expect(partial?.debt).toBe(300_000)
  })

  it('endDate dan keyingi oylar hisoblanmaydi', () => {
    const row = debtOn('2026-12-20', [pay('t1', '2026-09-01', 600_000)], { status: 'left', endDate: '2026-10-15' })
    // Sentyabr to'langan, oktyabr (ketgan oyi) to'liq, noyabr-dekabr — yo'q
    expect(row?.debt).toBe(600_000)
  })

  it('birinchi oy: "kunlar bo\'yicha" yoqilsa — ulushda, aks holda to\'liq', () => {
    const start = { startDate: '2026-09-16' }
    expect(debtOn('2026-09-20', [], start)?.debt).toBe(600_000)
    expect(debtOn('2026-09-20', [], start, { prorateFirstMonth: true, paymentDueDay: 10 })?.debt).toBe(300_000)
    // Birinchi oyning muddati — boshlangan kun: o'sha kuni hali qarz emas
    expect(debtOn('2026-09-16', [], start)?.debt).toBe(0)
  })

  it('enrollmentId siz eski to\'lovlar shu kurs bo\'yicha faol o\'qishga bog\'lanadi; boshqa o\'qishniki hisoblanmaydi', () => {
    const python = { ...ielts, id: 'k2', name: 'Python' }
    const pyGroup = { ...group, id: 'g2', name: 'Python', courseId: 'k2' }
    const enrollments = [base, { ...base, id: 'e2', groupId: 'g2' }]
    const transactions = [pay('t1', '2026-09-01', 600_000), pay('t2', '2026-09-02', 600_000, { enrollmentId: 'e2' })]
    const row = customerDebt(student, [ielts, python], transactions, new Date('2026-09-20T12:00:00'), { groups: [group, pyGroup], enrollments, settings: DEFAULT_DEBT_SETTINGS })
    expect(row?.ledgers.map((l) => [l.enrollment.id, l.paid])).toEqual([
      ['e1', 600_000],
      ['e2', 600_000],
    ])
    expect(row?.debt).toBe(0)
    expect(row?.label).toBe('IELTS — kechki, Python')
  })

  it('computeDebts: faqat qarzi borlar, kattasidan; 12 oy jadvali', () => {
    const rows = computeDebts([student], [ielts], [pay('t1', '2026-09-01', 600_000)], new Date('2026-11-20T12:00:00'), ctx())
    expect(rows).toHaveLength(1)
    expect(rows[0].debt).toBe(1_200_000)
    const table = last12Months(rows[0], new Date('2026-11-20T12:00:00'))
    expect(table.map((m) => [m.period, m.expected, m.paid, m.balance])).toEqual([
      ['2026-09', 600_000, 600_000, 0],
      ['2026-10', 600_000, 0, -600_000],
      ['2026-11', 600_000, 0, -1_200_000],
    ])
    expect(monthExpected({ ...base, status: 'paused' }, '2026-11', 600_000, DEFAULT_DEBT_SETTINGS)).toBe(0)
  })
})
