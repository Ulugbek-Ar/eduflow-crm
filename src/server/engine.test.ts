import { describe, expect, it } from 'vitest'
import { attendanceToRow, courseToRow, customerToRow, enrollmentToRow, groupToRow, transactionToRow } from '../data/mappers'
import { generateDemo } from '../services/demo/generator'
import { attendanceRate, recordsFor } from '../utils/attendance'
import { computeDebts, customerDebt, DEFAULT_DEBT_SETTINGS } from '../utils/debts'
import { allocatePayment, customerReports, debtorReminders, pickDebtor, tashkentNow } from './engine'
import type { OrgRows } from './engine'

const ORG = '11111111-2222-3333-4444-555555555555'

// Demo markaz -> bazadagi qatorlar ko'rinishi (Edge Function shunday o'qiydi)
function demoRows(now: Date): { rows: OrgRows; demo: ReturnType<typeof generateDemo> } {
  const demo = generateDemo(now)
  const rows: OrgRows = {
    settings: { orgName: 'Bilim Plus', paymentDueDay: 10, prorateFirstMonth: false },
    customers: demo.customers.map((c) => customerToRow(c, ORG)),
    courses: demo.courses.map((c) => courseToRow(c, ORG)),
    transactions: demo.transactions.map((t) => transactionToRow(t, ORG)),
    groups: demo.groups.map((g) => groupToRow(g, ORG)),
    enrollments: demo.enrollments.map((e) => enrollmentToRow(e, ORG)),
    attendance: demo.attendance.map((a) => attendanceToRow(a, ORG)),
  }
  return { rows, demo }
}

describe('server hisobi (engine)', () => {
  it('qarzdorlar ilovadagi hisob bilan aynan bir xil; eslatma matni shablon bo\'yicha', () => {
    const now = new Date('2026-11-20T09:00:00')
    const { rows, demo } = demoRows(now)
    const expected = computeDebts(demo.customers, demo.courses, demo.transactions, now, { groups: demo.groups, enrollments: demo.enrollments, settings: DEFAULT_DEBT_SETTINGS })
    const result = debtorReminders(rows, { now, lang: 'uz', withLink: false })
    expect(result.map((r) => [r.customerId, r.debt])).toEqual(expected.map((r) => [r.customer.id, r.debt]))
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].text).toContain(`Assalomu alaykum, ${result[0].name}!`)
    expect(result[0].text).toContain('noyabr oyi to\'lovi')
    const ru = debtorReminders(rows, { now, lang: 'ru', withLink: false })
    expect(ru[0].text).toContain(`Здравствуйте, ${ru[0].name}!`)
    expect(ru[0].text).toContain('сум')
  })

  it('savatchadagi mijoz va uning o\'qishi hisobga kirmaydi; onlayn to\'lov ulangan bo\'lsa — havola', () => {
    const now = new Date('2026-11-20T09:00:00')
    const { rows } = demoRows(now)
    const [first] = debtorReminders(rows, { now, lang: 'uz', withLink: true })
    const trashed: OrgRows = { ...rows, customers: rows.customers.map((r) => (r.id === first.customerId ? { ...r, deleted_at: now.toISOString() } : r)) }
    expect(debtorReminders(trashed, { now, lang: 'uz', withLink: true }).some((r) => r.customerId === first.customerId)).toBe(false)
    expect(first.text).not.toContain('checkout.paycom.uz')
    const withPayme: OrgRows = { ...rows, settings: { ...(rows.settings as object), paymeMerchantId: '5e730e8e0b852a417aa49ceb' } }
    expect(debtorReminders(withPayme, { now, lang: 'uz', withLink: true })[0].text).toMatch(/To'lov havolasi: https:\/\/checkout\.paycom\.uz\//)
  })

  it('Toshkent vaqti: UTC + 5 soat', () => {
    expect(tashkentNow(Date.UTC(2026, 10, 30, 20, 0)).getUTCDate()).toBe(1)
  })

  it('yig\'ma (generated/engine.js) manbadagi bilan bir xil ishlaydi va eksportlar .d.ts bilan mos', async () => {
    const bundle = (await import('../../supabase/functions/_shared/generated/engine.js')) as Record<string, unknown>
    expect(Object.keys(bundle).sort()).toEqual(['allocatePayment', 'customerReports', 'debtorReminders', 'pickDebtor', 'tashkentNow'])
    const now = new Date('2026-11-20T09:00:00')
    const { rows } = demoRows(now)
    const fromBundle = (bundle.debtorReminders as typeof debtorReminders)(rows, { now, lang: 'uz', withLink: false })
    expect(fromBundle).toEqual(debtorReminders(rows, { now, lang: 'uz', withLink: false }))
  })

  it('o\'quvchi hisoboti (Telegram bot): qarz ilovadagidek, faol guruhlar va oxirgi 30 kun davomati', () => {
    const now = new Date('2026-11-20T09:00:00')
    const { rows, demo } = demoRows(now)
    const [debtor] = debtorReminders(rows, { now, lang: 'uz', withLink: false })
    const [r] = customerReports(rows, [debtor.customerId, 'yoq'], { now, lang: 'uz' })
    const customer = demo.customers.find((c) => c.id === debtor.customerId)
    expect(customer).toBeDefined()
    if (!customer) return
    const own = demo.enrollments.filter((e) => e.customerId === customer.id)
    expect(r.debt).toBe(customerDebt(customer, demo.courses, demo.transactions, now, { groups: demo.groups, enrollments: own, settings: DEFAULT_DEBT_SETTINGS })?.debt)
    expect(r.groups.length).toBeGreaterThan(0)
    const month = recordsFor(demo.attendance, { customerId: customer.id, from: '2026-10-21', to: '2026-11-20' })
    expect(r.attendance.present + r.attendance.absent).toBe(month.length)
    expect(r.attendance.rate).toBe(attendanceRate(month))
    expect(r.attendance.recent.length).toBeLessThanOrEqual(5)
  })
})

describe('N-1: onlayn to\'lovni taqsimlash', () => {
  const now = new Date('2026-11-20T09:00:00')
  const at = '2026-08-01T00:00:00.000Z'
  const rowsWith = (transactions: Parameters<typeof transactionToRow>[0][] = []): OrgRows => ({
    settings: { paymentDueDay: 10, prorateFirstMonth: false },
    customers: [
      customerToRow({ id: 'c1', name: 'Aka', phone: '+998 90 123 45 67', course: 'Matematika', status: 'paid', source: 'website', createdAt: at } as never, ORG),
      customerToRow({ id: 'c2', name: 'Uka', phone: '+998 90 123 45 67', course: 'Matematika', status: 'new', source: 'website', createdAt: at } as never, ORG),
    ],
    courses: [courseToRow({ id: 'k1', name: 'Matematika', type: 'course', durationMonths: 0, monthlyPrice: 500_000, status: 'active', createdAt: at } as never, ORG)],
    groups: ['g1', 'g2'].map((id) => groupToRow({ id, name: id, courseId: 'k1', room: '', days: ['mon'], startTime: '09:00', endTime: '10:00', capacity: 10, startDate: '2026-08-01', status: 'active', createdAt: at } as never, ORG)),
    enrollments: [
      enrollmentToRow({ id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-09-01', status: 'active', createdAt: at } as never, ORG),
      enrollmentToRow({ id: 'e2', customerId: 'c1', groupId: 'g2', startDate: '2026-10-01', status: 'active', createdAt: at } as never, ORG),
    ],
    transactions: transactions.map((t) => transactionToRow(t, ORG)),
  })

  it('2 guruhli o\'quvchi: avval eski o\'qish qarzi (1.5 mln), keyin yangisi; qoldiq — eski faol o\'qishga', () => {
    expect(allocatePayment(rowsWith(), 'c1', 2_000_000, now)).toEqual([{ enrollmentId: 'e1', amount: 1_500_000 }, { enrollmentId: 'e2', amount: 500_000 }])
    expect(allocatePayment(rowsWith(), 'c1', 3_000_000, now)).toEqual([{ enrollmentId: 'e1', amount: 2_000_000 }, { enrollmentId: 'e2', amount: 1_000_000 }])
    expect(allocatePayment(rowsWith(), 'c2', 100_000, now)).toEqual([{ enrollmentId: null, amount: 100_000 }])
  })

  it('taqsimlangan to\'lovdan keyin qarz yopiladi', () => {
    const parts = allocatePayment(rowsWith(), 'c1', 2_500_000, now)
    const paid = parts.map((p, i) => ({ id: `t${i}`, type: 'income', amount: p.amount, method: 'card', category: 'course_fee', note: '', customerId: 'c1', status: 'paid', date: now.toISOString(), enrollmentId: p.enrollmentId ?? undefined }))
    expect(customerReports(rowsWith(paid as never), ['c1'], { now, lang: 'uz' })[0].debt).toBe(0)
  })

  it('N-2: test kaliti bilan kelgan (is_test) kirim qarzni kamaytirmaydi', () => {
    const rows = rowsWith([{ id: 'tt', type: 'income', amount: 2_500_000, method: 'card', category: 'course_fee', note: '', customerId: 'c1', status: 'paid', date: now.toISOString(), enrollmentId: 'e1' } as never])
    rows.transactions = rows.transactions.map((r) => ({ ...r, is_test: true }))
    expect(customerReports(rows, ['c1'], { now, lang: 'uz' })[0].debt).toBe(2_500_000)
  })

  it('QA-13: bot davomatida qoldirilgan dars oxirgi 5 ta yozuvdan tushib qolmaydi', () => {
    const rows = rowsWith()
    const days = ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16']
    rows.attendance = days.map((date, i) => attendanceToRow({ id: `a${i}`, groupId: 'g1', customerId: 'c1', date, status: i === 0 ? 'absent' : 'present' } as never, ORG))
    expect(customerReports(rows, ['c1'], { now, lang: 'uz' })[0].attendance.recent[0]).toMatchObject({ date: '2026-11-02', status: 'absent' })
  })

  it('aka-uka bitta telefonda: qarzi bor yagona o\'quvchi tanlanadi, aks holda null', () => {
    expect(pickDebtor(rowsWith(), ['c1', 'c2'], now)).toBe('c1')
    expect(pickDebtor(rowsWith(), ['c2'], now)).toBeNull()
  })
})
