import { describe, expect, it } from 'vitest'
import { conversion, filterByPeriod, getPeriod, overviewKpis, sumExpense, sumIncome } from '../../utils/analytics'
import { computeDebts, DEFAULT_DEBT_SETTINGS } from '../../utils/debts'
import { hasLessonOn, occupiesSeat } from '../../utils/groups'
import { isAttendanceRecord, isCourse, isCustomer, isEnrollment, isGroup, isTeacher, isTransaction } from '../../utils/guards'
import { demoWindows, generateDemo } from './generator'
import { hashSeed, mulberry32, Rng } from './prng'

// Qabul mezoni: oyning 1, 2, 7, 15, 28, 31-kuni, 1-yanvar va 31-dekabr (turli soatlarda)
const DATES = [
  '2026-03-01T10:30',
  '2026-03-02T09:15',
  '2026-03-07T18:40',
  '2026-03-15T12:00',
  '2026-02-28T16:20',
  '2026-03-31T11:00',
  '2026-01-01T10:00',
  '2026-12-31T17:30',
  '2026-11-01T00:20',
  '2027-08-15T08:05',
]

const inWindow = (iso: string, w: { start: Date; end: Date }) => {
  const t = Date.parse(iso)
  return t >= w.start.getTime() && t <= w.end.getTime()
}

describe('PRNG', () => {
  it('bir xil urug\' — bir xil ketma-ketlik; Math.random ishlatilmaydi', () => {
    const a = mulberry32(hashSeed('2026-11-07'))
    const b = mulberry32(hashSeed('2026-11-07'))
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(hashSeed('2026-11-07')).not.toBe(hashSeed('2026-11-08'))
    const rng = new Rng(1)
    for (let i = 0; i < 200; i++) {
      const n = rng.int(3, 5)
      expect(n >= 3 && n <= 5).toBe(true)
    }
  })
})

describe('demo generatori — davrga moslashgan', () => {
  for (const date of DATES) {
    it(`${date}: "Shu oy" KPI'lari > 0, trendlar bor, chiqim va qarzdorlar bor`, () => {
      const now = new Date(date)
      const { customers, transactions, courses, enrollments, groups, attendance } = generateDemo(now)
      const kpi = overviewKpis(customers, transactions, 'month', now, enrollments)
      expect(kpi.revenue.value).toBeGreaterThan(0)
      expect(kpi.active.value).toBeGreaterThan(0)
      expect(kpi.newLeads.value).toBeGreaterThan(0)
      expect(kpi.conversion.value ?? 0).toBeGreaterThan(0)
      expect(kpi.revenue.change).not.toBeNull()
      expect(kpi.active.change).not.toBeNull()
      expect(kpi.newLeads.change).not.toBeNull()
      expect(kpi.conversion.change).not.toBeNull()
      // Trendlar asosan ijobiy: tushum va yangi lidlar o'tgan oyning shu kunigacha bo'lganidan kam emas
      expect(kpi.revenue.change ?? 0).toBeGreaterThanOrEqual(0)
      expect(kpi.newLeads.change ?? 0).toBeGreaterThanOrEqual(0)
      expect(sumExpense(filterByPeriod(transactions, (t) => t.date, getPeriod('month', now)))).toBeGreaterThan(0)
      // v11: o'qish (guruh) asosidagi qarz — rejadagi 4–7 qarzdor, boshqalarda qarz yo'q
      const debts = computeDebts(customers, courses, transactions, now, { groups, enrollments, settings: DEFAULT_DEBT_SETTINGS })
      expect(debts.length).toBeGreaterThanOrEqual(4)
      expect(debts.length).toBeLessThanOrEqual(7)
      // Kelajakdagi to'langan yozuv yo'q ("Kutilmoqda" — kelajak sanasi bilan bo'lishi mumkin)
      expect(transactions.filter((t) => t.status === 'paid' && Date.parse(t.date) > now.getTime())).toEqual([])
      expect(customers.filter((c) => Date.parse(c.createdAt) > now.getTime())).toEqual([])
      // Faol o'quvchilar 45–60, guruhlar 6–8, sig'imdan oshmaydi, bitta guruh deyarli to'lgan
      expect(kpi.active.value).toBeGreaterThanOrEqual(45)
      expect(kpi.active.value).toBeLessThanOrEqual(60)
      expect(groups.length).toBeGreaterThanOrEqual(6)
      expect(groups.length).toBeLessThanOrEqual(8)
      const day = date.slice(0, 10)
      const seats = groups.map((g) => enrollments.filter((e) => e.groupId === g.id && occupiesSeat(e, day)).length)
      groups.forEach((g, i) => expect(seats[i], g.name).toBeLessThanOrEqual(g.capacity))
      expect(groups.some((g, i) => seats[i] >= g.capacity - 1)).toBe(true)
      // Ish kunlarida (dushanba–shanba) bugungi darslar bor
      if (now.getDay() !== 0) expect(groups.some((g) => hasLessonOn(g, day))).toBe(true)
      // Oxirgi 8 hafta davomati: 85–92% atrofida kelgan
      const came = attendance.filter((r) => r.status === 'present' || r.status === 'late').length
      expect(attendance.length).toBeGreaterThan(300)
      expect(came / attendance.length).toBeGreaterThan(0.82)
      expect(came / attendance.length).toBeLessThan(0.95)
    })

    it(`${date}: har bir davr va uning oldingi teng davrida yangi lid va to'langan kirim; konversiya ("Bugun"dan tashqari)`, () => {
      const now = new Date(date)
      const { customers, transactions } = generateDemo(now)
      for (const w of demoWindows(now)) {
        const label = `${w.range}${w.previous ? ' (oldingi)' : ''}`
        const leads = customers.filter((c) => inWindow(c.createdAt, w))
        expect(leads.length, `${label}: lid`).toBeGreaterThan(0)
        expect(sumIncome(transactions.filter((t) => inWindow(t.date, w))), `${label}: kirim`).toBeGreaterThan(0)
        if (w.range !== 'today') expect(conversion(leads) ?? 0, `${label}: konversiya`).toBeGreaterThan(0)
      }
    })
  }

  it('tarkib: 45–60 o\'quvchi, 4–7 qarzdor, kutilayotgan va bekor qilingan to\'lov, bekor qilingan lidlar; yozuvlar to\'g\'ri', () => {
    for (const date of DATES) {
      const now = new Date(date)
      const { customers, transactions, courses, plan } = generateDemo(now)
      const active = plan.students.filter((s) => s.status === 'active').length
      expect(active, date).toBeGreaterThanOrEqual(45)
      expect(active, date).toBeLessThanOrEqual(60)
      const debtors = plan.students.filter((s) => s.debtor).length
      expect(debtors).toBeGreaterThanOrEqual(4)
      expect(debtors).toBeLessThanOrEqual(7)
      const pending = transactions.filter((t) => t.status === 'pending').length
      expect(pending).toBeGreaterThanOrEqual(1)
      expect(pending).toBeLessThanOrEqual(2)
      expect(transactions.some((t) => t.status === 'cancelled')).toBe(true)
      expect(customers.filter((c) => c.status === 'cancelled').length).toBeGreaterThan(3)
      expect(customers.every(isCustomer)).toBe(true)
      expect(transactions.every(isTransaction)).toBe(true)
      expect(courses.every(isCourse)).toBe(true)
      const built = generateDemo(now)
      expect(built.teachers.length).toBe(4)
      expect(built.groups.every(isGroup)).toBe(true)
      expect(built.enrollments.every(isEnrollment)).toBe(true)
      expect(built.attendance.every(isAttendanceRecord)).toBe(true)
      expect(built.teachers.every(isTeacher)).toBe(true)
      // Kurs to'lovlari guruh (enrollment) va oyga bog'langan; maosh — o'qituvchiga
      expect(transactions.filter((t) => t.category === 'course_fee').every((t) => t.enrollmentId && t.period)).toBe(true)
      expect(transactions.filter((t) => t.category === 'salary').every((t) => t.teacherId && t.period)).toBe(true)
      expect(new Set(customers.map((c) => c.phone)).size).toBe(customers.length)
      expect(customers.filter((c) => c.status === 'paid').every((c) => c.paidAt && c.paidAt >= c.createdAt)).toBe(true)
      // 12 oydan kam bo'lmagan tarix
      const first = Math.min(...transactions.map((t) => Date.parse(t.date)))
      expect(now.getTime() - first).toBeGreaterThan(365 * 86_400_000 - 86_400_000)
    }
  })

  it('har oy: ijara 1-kuni, maosh 5-kuni, manbali marketing', () => {
    const now = new Date('2026-11-20T12:00')
    const { transactions } = generateDemo(now)
    const months = new Map<string, Set<string>>()
    for (const t of transactions.filter((x) => x.type === 'expense')) {
      const d = new Date(t.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const set = months.get(key) ?? new Set<string>()
      set.add(t.category)
      months.set(key, set)
      if (t.category === 'rent') expect(d.getDate()).toBe(1)
      if (t.category === 'salary') expect([5, 6]).toContain(d.getDate())
      if (t.category === 'marketing') expect(t.source).toBeDefined()
    }
    for (const [key, categories] of months) {
      expect(categories.has('rent'), key).toBe(true)
      expect(categories.has('marketing'), key).toBe(true)
    }
  })

  it('deterministik: bir kunda (ertalab va kechqurun) bir xil, boshqa kunda boshqacha', () => {
    const morning = generateDemo(new Date('2026-11-07T08:10'))
    const evening = generateDemo(new Date('2026-11-07T21:45'))
    expect(evening.customers.map((c) => [c.id, c.name, c.phone, c.status])).toEqual(morning.customers.map((c) => [c.id, c.name, c.phone, c.status]))
    expect(evening.transactions.length).toBe(morning.transactions.length)
    // Bugungi hodisalar vaqti "hozir"dan oldinga qisiladi — tartib emas, tarkib bir xil
    const summary = (list: typeof morning.transactions) => list.map((t) => `${t.type}:${t.amount}:${t.customerId ?? ''}:${t.date.slice(0, 10)}`).sort()
    expect(summary(evening.transactions)).toEqual(summary(morning.transactions))
    const tomorrow = generateDemo(new Date('2026-11-08T10:00'))
    expect(tomorrow.customers.map((c) => c.name)).not.toEqual(morning.customers.map((c) => c.name))
  })
})
