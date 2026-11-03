import { describe, expect, it } from 'vitest'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import {
  activeCustomersAt,
  averageOrderValue,
  breakdown,
  cashBalance,
  conversion,
  customPeriod,
  filterByPeriod,
  getPeriod,
  getPreviousPeriod,
  groupByMonth,
  groupByWeek,
  inPeriod,
  isPaid,
  niceScale,
  overlaps,
  overviewKpis,
  paidOnly,
  payingCustomers,
  pointChange,
  recentActivity,
  safeRatio,
  shiftMonths,
  sourcePerformance,
  sourceStats,
  sumExpense,
  sumIncome,
  totalPerformance,
  trend,
} from './analytics'

// Chorshanba, 2026-yil 28-oktabr 15:00 (mahalliy vaqt)
const NOW = new Date(2026, 9, 28, 15, 0)

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString()

function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>): Transaction {
  return { id: Math.random().toString(36), method: 'cash', category: partial.type === 'income' ? 'course_fee' : 'rent', note: '', status: 'paid', ...partial }
}

function customer(partial: Partial<Customer>): Customer {
  return {
    id: Math.random().toString(36),
    name: 'Test',
    phone: '+998 90 000 00 00',
    course: 'IELTS',
    status: 'new',
    source: 'telegram',
    createdAt: at(2026, 9, 1),
    ...partial,
  }
}

describe('getPeriod', () => {
  it('bugun: kun boshidan oxirigacha', () => {
    const p = getPeriod('today', NOW)
    expect(p.start).toEqual(new Date(2026, 9, 28, 0, 0, 0, 0))
    expect(p.end).toEqual(new Date(2026, 9, 28, 23, 59, 59, 999))
  })

  it('7 kun bugun bilan birga', () => {
    expect(getPeriod('7d', NOW).start).toEqual(new Date(2026, 9, 22))
  })

  it('shu oy va shu yil', () => {
    expect(getPeriod('month', NOW).start).toEqual(new Date(2026, 9, 1))
    expect(getPeriod('year', NOW).start).toEqual(new Date(2026, 0, 1))
  })
})

describe('getPreviousPeriod', () => {
  it('oy: o\'tgan oyning xuddi shu kunlari', () => {
    const p = getPreviousPeriod('month', NOW)
    expect(p.start).toEqual(new Date(2026, 8, 1))
    expect(p.end).toEqual(new Date(2026, 8, 28, 23, 59, 59, 999))
  })

  it('31-mart -> 28-fevral (oy oxiriga qisiladi)', () => {
    const p = getPreviousPeriod('month', new Date(2026, 2, 31, 10))
    expect(p.end).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999))
  })

  it('kabisa yili: 31-mart 2024 -> 29-fevral', () => {
    expect(shiftMonths(new Date(2024, 2, 31), -1)).toEqual(new Date(2024, 1, 29))
  })

  it('kun, hafta va yil', () => {
    expect(getPreviousPeriod('today', NOW).start).toEqual(new Date(2026, 9, 27))
    expect(getPreviousPeriod('7d', NOW).start).toEqual(new Date(2026, 9, 15))
    expect(getPreviousPeriod('year', NOW)).toEqual({ start: new Date(2025, 0, 1), end: new Date(2025, 9, 28, 23, 59, 59, 999) })
  })
})

describe('customPeriod va inPeriod', () => {
  it('ikkala chegara bo\'sh bo\'lsa null', () => {
    expect(customPeriod('', '')).toBeNull()
  })

  it('chegaralar kiritiladi (inclusive)', () => {
    const p = customPeriod('2026-10-01', '2026-10-05')
    expect(p).not.toBeNull()
    if (!p) return
    expect(inPeriod(new Date(2026, 9, 1, 0, 0).toISOString(), p)).toBe(true)
    expect(inPeriod(new Date(2026, 9, 5, 23, 59).toISOString(), p)).toBe(true)
    expect(inPeriod(new Date(2026, 9, 6, 0, 0).toISOString(), p)).toBe(false)
    expect(inPeriod(new Date(2026, 8, 30, 23, 59).toISOString(), p)).toBe(false)
  })

  it('faqat boshlanish sanasi berilsa oxiri cheklanmaydi', () => {
    const p = customPeriod('2026-10-01', '')
    expect(p && inPeriod(at(2030, 0, 1), p)).toBe(true)
  })

  it('filterByPeriod', () => {
    const items = [tx({ type: 'income', amount: 1, date: at(2026, 9, 28) }), tx({ type: 'income', amount: 2, date: at(2026, 8, 30) })]
    expect(filterByPeriod(items, (t) => t.date, getPeriod('month', NOW))).toHaveLength(1)
  })
})

describe('yig\'indilar, konversiya va trend', () => {
  const list = [
    tx({ type: 'income', amount: 500, date: at(2026, 9, 1), customerId: 'a' }),
    tx({ type: 'income', amount: 300, date: at(2026, 9, 2), customerId: 'a' }),
    tx({ type: 'income', amount: 200, date: at(2026, 9, 3) }),
    tx({ type: 'expense', amount: 400, date: at(2026, 9, 4) }),
  ]

  it('sumIncome / sumExpense', () => {
    expect(sumIncome(list)).toBe(1000)
    expect(sumExpense(list)).toBe(400)
    expect(sumIncome([])).toBe(0)
  })

  it('payingCustomers takrorlanmas mijozlarni sanaydi', () => {
    expect(payingCustomers(list)).toBe(1)
  })

  it('conversion', () => {
    expect(conversion([])).toBeNull()
    const group = [customer({ status: 'new' }), customer({ status: 'paid' }), customer({ status: 'thinking' }), customer({ status: 'cancelled' })]
    // Faqat "To'lov qildi" bosqichidagilar konversiya hisoblanadi
    expect(conversion(group)).toBe(25)
  })

  it('trend: oldingi 0 bo\'lsa null', () => {
    expect(trend(150, 100)).toBe(50)
    expect(trend(50, 100)).toBe(-50)
    expect(trend(5, 0)).toBeNull()
    expect(trend(0, 0)).toBeNull()
    expect(trend(-50, -100)).toBe(50)
  })

  it('pointChange', () => {
    expect(pointChange(40, 100)).toBe(-60)
    expect(pointChange(null, 10)).toBeNull()
  })
})

describe('guruhlash', () => {
  it('groupByMonth: oxirgi 6 oy, chegaradagi tranzaksiyalar', () => {
    const buckets = groupByMonth(
      [
        tx({ type: 'income', amount: 100, date: at(2026, 9, 28) }),
        tx({ type: 'expense', amount: 40, date: at(2026, 4, 1, 0) }),
        tx({ type: 'income', amount: 999, date: at(2026, 3, 30) }),
      ],
      6,
      NOW,
    )
    expect(buckets.map((b) => b.label)).toEqual(['May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt'])
    expect(buckets[5].income).toBe(100)
    expect(buckets[0].expense).toBe(40)
    expect(buckets.reduce((s, b) => s + b.income, 0)).toBe(100)
  })

  it('groupByMonth: yil chegarasi', () => {
    const buckets = groupByMonth([], 3, new Date(2026, 1, 10))
    expect(buckets.map((b) => b.longLabel)).toEqual(['Dek 2025', 'Yan 2026', 'Fev 2026'])
  })

  it('groupByWeek: haftalar dushanbadan boshlanadi', () => {
    const buckets = groupByWeek([tx({ type: 'income', amount: 7, date: at(2026, 10, 1) })], 8, new Date(2026, 10, 1, 9))
    expect(buckets).toHaveLength(8)
    expect(buckets[7].start).toEqual(new Date(2026, 9, 26))
    expect(buckets[7].end).toEqual(new Date(2026, 10, 1, 23, 59, 59, 999))
    expect(buckets[7].income).toBe(7)
    expect(buckets[0].start).toEqual(new Date(2026, 8, 7))
  })

  it('overlaps', () => {
    const [bucket] = groupByMonth([], 1, NOW)
    expect(overlaps(bucket, getPeriod('7d', NOW))).toBe(true)
    expect(overlaps(bucket, getPreviousPeriod('month', NOW))).toBe(false)
  })

  it('niceScale', () => {
    expect(niceScale(0)).toEqual({ max: 4, step: 1 })
    expect(niceScale(5_000_000)).toEqual({ max: 6_000_000, step: 2_000_000 })
    expect(niceScale(950)).toEqual({ max: 1000, step: 250 })
  })
})

describe('taqsimotlar', () => {
  it('breakdown: ulushlar 100 ga teng, nollar saqlanadi, kamayish tartibida', () => {
    const rows = breakdown(
      [
        tx({ type: 'income', amount: 300, date: at(2026, 9, 1), method: 'card' }),
        tx({ type: 'income', amount: 100, date: at(2026, 9, 1), method: 'cash' }),
        // Kutilmoqda va bekor qilingan taqsimotga kirmaydi
        tx({ type: 'income', amount: 900, date: at(2026, 9, 1), method: 'transfer', status: 'pending' }),
        tx({ type: 'income', amount: 900, date: at(2026, 9, 1), method: 'transfer', status: 'cancelled' }),
      ],
      ['cash', 'card', 'transfer'] as const,
      (t) => t.method,
    )
    expect(rows.map((r) => r.key)).toEqual(['card', 'cash', 'transfer'])
    expect(rows[0].share).toBe(75)
    expect(rows.reduce((s, r) => s + r.share, 0)).toBe(100)
  })

  it('breakdown: bo\'sh ro\'yxatda 0 ulush', () => {
    expect(breakdown([], ['rent'] as const, (t) => t.category as 'rent')[0].share).toBe(0)
  })

  it('sourceStats: soni, ulushi va konversiyasi', () => {
    const stats = sourceStats(
      [customer({ source: 'instagram', status: 'paid' }), customer({ source: 'instagram', status: 'new' }), customer({ source: 'telegram' })],
      ['telegram', 'instagram', 'website'],
    )
    expect(stats[0]).toMatchObject({ source: 'instagram', count: 2, conversion: 50 })
    expect(stats.find((s) => s.source === 'website')?.conversion).toBeNull()
  })

  it('recentActivity: sana bo\'yicha va limit', () => {
    const items = recentActivity(
      [customer({ id: 'c', createdAt: at(2026, 9, 27) })],
      [tx({ id: 't1', type: 'income', amount: 1, date: at(2026, 9, 28) }), tx({ id: 't2', type: 'income', amount: 1, date: at(2026, 9, 1) })],
      2,
    )
    expect(items.map((i) => i.id)).toEqual(['t1', 'c'])
  })
})

describe('faqat "To\'langan" hisoblanadi', () => {
  it('sumIncome, sumExpense, cashBalance, payingCustomers va grafik kutilmoqda/bekor qilinganni o\'tkazib yuboradi', () => {
    const list = [
      tx({ type: 'income', amount: 1000, date: at(2026, 9, 5), customerId: 'a' }),
      tx({ type: 'income', amount: 500, date: at(2026, 9, 6), customerId: 'b', status: 'pending' }),
      tx({ type: 'income', amount: 700, date: at(2026, 9, 7), customerId: 'c', status: 'cancelled' }),
      tx({ type: 'expense', amount: 300, date: at(2026, 9, 8) }),
      tx({ type: 'expense', amount: 900, date: at(2026, 9, 8), status: 'pending' }),
    ]
    expect(isPaid(list[0])).toBe(true)
    expect(paidOnly(list)).toHaveLength(2)
    expect(sumIncome(list)).toBe(1000)
    expect(sumExpense(list)).toBe(300)
    expect(cashBalance(list)).toBe(700)
    expect(payingCustomers(list)).toBe(1)
    const october = groupByMonth(list, 1, NOW)[0]
    expect(october).toMatchObject({ income: 1000, expense: 300 })
  })
})

describe('overviewKpis', () => {
  // NOW = 2026-10-28; 'month' davri: 1–28-oktabr, oldingi: 1–28-sentabr
  const people = [
    customer({ id: 'a', status: 'paid', createdAt: at(2026, 9, 3) }),
    customer({ id: 'b', status: 'new', createdAt: at(2026, 9, 10) }),
    customer({ id: 'c', status: 'contacted', createdAt: at(2026, 9, 12) }),
    customer({ id: 'd', status: 'paid', createdAt: at(2026, 9, 20) }),
    customer({ id: 'e', status: 'paid', createdAt: at(2026, 8, 5) }),
    customer({ id: 'f', status: 'cancelled', createdAt: at(2026, 8, 6) }),
  ]
  const money = [
    tx({ type: 'income', amount: 2000, date: at(2026, 9, 5) }),
    tx({ type: 'income', amount: 9999, date: at(2026, 9, 6), status: 'pending' }),
    tx({ type: 'income', amount: 1000, date: at(2026, 8, 5) }),
  ]

  it('Jami tushum — faqat to\'langan, trend oldingi davrga nisbatan', () => {
    expect(overviewKpis(people, money, 'month', NOW).revenue).toEqual({ value: 2000, change: 100 })
  })

  it('Faol mijozlar — "To\'lov qildi", davr oxiri holati', () => {
    // hozir: a, d, e = 3; oldingi davr oxiri (28-sentabr): faqat e = 1
    expect(overviewKpis(people, money, 'month', NOW).active).toEqual({ value: 3, change: 200 })
  })

  it('Yangi lidlar — davrda qo\'shilganlar; konversiya — ulardan "To\'lov qildi" (foiz bandida o\'zgarish)', () => {
    const k = overviewKpis(people, money, 'month', NOW)
    expect(k.newLeads).toEqual({ value: 4, change: 100 })
    // oktabr: 4 liddan 2 tasi to'lov qildi = 50%; sentabr: 2 dan 1 = 50%
    expect(k.conversion).toEqual({ value: 50, change: 0 })
    expect(activeCustomersAt(people, new Date(2026, 8, 1))).toBe(0)
  })

  it('ma\'lumot bo\'lmasa trend va konversiya "—" (null)', () => {
    expect(overviewKpis([], [], 'today', NOW)).toEqual({
      revenue: { value: 0, change: null },
      active: { value: 0, change: null },
      newLeads: { value: 0, change: null },
      conversion: { value: null, change: null },
    })
  })
})

describe('tahlil formulalari', () => {
  const october = getPeriod('month', NOW)

  it('AOV = to\'langan kirimlar summasi / ular soni; to\'lov bo\'lmasa null', () => {
    const list = [
      tx({ type: 'income', amount: 600, date: at(2026, 9, 1) }),
      tx({ type: 'income', amount: 300, date: at(2026, 9, 2) }),
      tx({ type: 'income', amount: 5000, date: at(2026, 9, 2), status: 'pending' }),
      tx({ type: 'expense', amount: 999, date: at(2026, 9, 2) }),
    ]
    expect(averageOrderValue(list)).toEqual({ value: 450, count: 2, total: 900 })
    expect(averageOrderValue([])).toEqual({ value: null, count: 0, total: 0 })
  })

  it('manbalar samaradorligi: lidlar, konversiya, CPL, ROI', () => {
    const people = [
      customer({ id: 'i1', source: 'instagram', status: 'paid', createdAt: at(2026, 9, 2) }),
      customer({ id: 'i2', source: 'instagram', status: 'new', createdAt: at(2026, 9, 3) }),
      customer({ id: 'i3', source: 'instagram', status: 'paid', createdAt: at(2026, 9, 4) }),
      customer({ id: 'i4', source: 'instagram', status: 'contacted', createdAt: at(2026, 9, 5) }),
      // O'tgan oyda kelgan, lekin shu oy to'lagan — kirim ROI ga kiradi, lid soniga emas
      customer({ id: 'i0', source: 'instagram', status: 'paid', createdAt: at(2026, 8, 5) }),
      customer({ id: 't1', source: 'telegram', status: 'new', createdAt: at(2026, 9, 5) }),
    ]
    const money = [
      tx({ type: 'expense', category: 'marketing', source: 'instagram', amount: 400_000, date: at(2026, 9, 1) }),
      tx({ type: 'expense', category: 'marketing', source: 'instagram', amount: 999_000, date: at(2026, 9, 1), status: 'pending' }),
      tx({ type: 'expense', category: 'marketing', amount: 50_000, date: at(2026, 9, 1) }), // manbasiz
      tx({ type: 'income', customerId: 'i1', amount: 650_000, date: at(2026, 9, 10) }),
      tx({ type: 'income', customerId: 'i0', amount: 350_000, date: at(2026, 9, 11) }),
      tx({ type: 'income', customerId: 'i3', amount: 100_000, date: at(2026, 8, 11) }), // davrdan tashqari
    ]
    const [instagram, telegram, website] = sourcePerformance(people, money, ['instagram', 'telegram', 'website'], october)
    expect(instagram).toEqual({ source: 'instagram', leads: 4, paid: 2, conversion: 50, spend: 400_000, cpl: 100_000, revenue: 1_000_000, roi: 150 })
    // Chiqim 0 — CPL va ROI "—" (null), nolga bo'linmaydi
    expect(telegram).toMatchObject({ leads: 1, paid: 0, conversion: 0, spend: 0, cpl: null, revenue: 0, roi: null })
    expect(website).toMatchObject({ leads: 0, conversion: null, cpl: null, roi: null })
    expect(totalPerformance([instagram, telegram, website])).toEqual({
      leads: 5,
      paid: 2,
      conversion: 40,
      spend: 400_000,
      cpl: 80_000,
      revenue: 1_000_000,
      roi: 150,
    })
  })

  it('ROI manfiy bo\'lishi mumkin; safeRatio nolga bo\'lmaydi', () => {
    const people = [customer({ id: 'a', source: 'website', createdAt: at(2026, 9, 2) })]
    const money = [tx({ type: 'expense', category: 'marketing', source: 'website', amount: 200, date: at(2026, 9, 2) })]
    expect(sourcePerformance(people, money, ['website'], october)[0]).toMatchObject({ cpl: 200, roi: -100 })
    expect(safeRatio(1, 0)).toBeNull()
    expect(safeRatio(3, 4)).toBe(0.75)
  })
})

describe('activeCustomersAt: paidAt bo\'yicha', () => {
  it('eski mijoz yaqinda to\'lov qilgan bo\'lsa, oldingi davr oxirida faol hisoblanmaydi', () => {
    const list = [
      customer({ status: 'paid', createdAt: at(2026, 0, 5), paidAt: at(2026, 9, 10) }),
      customer({ status: 'paid', createdAt: at(2026, 0, 5), paidAt: at(2026, 6, 1) }),
      customer({ status: 'paid', createdAt: at(2026, 0, 5) }), // paidAt yo'q — qo'shilgan sana
    ]
    expect(activeCustomersAt(list, new Date(2026, 8, 30))).toBe(2)
    expect(activeCustomersAt(list, new Date(2026, 9, 28))).toBe(3)
  })
})
