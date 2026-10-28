import { describe, expect, it } from 'vitest'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import {
  breakdown,
  conversion,
  customPeriod,
  filterByPeriod,
  getPeriod,
  getPreviousPeriod,
  groupByMonth,
  groupByWeek,
  inPeriod,
  niceScale,
  overlaps,
  payingCustomers,
  pointChange,
  recentActivity,
  shiftMonths,
  sourceStats,
  sumExpense,
  sumIncome,
  trend,
} from './analytics'

// Chorshanba, 2026-yil 28-oktabr 15:00 (mahalliy vaqt)
const NOW = new Date(2026, 9, 28, 15, 0)

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString()

function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>): Transaction {
  return { id: Math.random().toString(36), method: 'cash', category: partial.type === 'income' ? 'course_fee' : 'rent', note: '', ...partial }
}

function customer(partial: Partial<Customer>): Customer {
  return {
    id: Math.random().toString(36),
    name: 'Test',
    phone: '+998 90 000 00 00',
    course: 'IELTS',
    status: 'lead',
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
    const group = [customer({ status: 'lead' }), customer({ status: 'active' }), customer({ status: 'paused' }), customer({ status: 'left' })]
    expect(conversion(group)).toBe(75)
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
      [tx({ type: 'income', amount: 300, date: at(2026, 9, 1), method: 'click' }), tx({ type: 'income', amount: 100, date: at(2026, 9, 1), method: 'cash' })],
      ['payme', 'click', 'cash', 'bank'] as const,
      (t) => t.method,
    )
    expect(rows.map((r) => r.key)).toEqual(['click', 'cash', 'payme', 'bank'])
    expect(rows[0].share).toBe(75)
    expect(rows.reduce((s, r) => s + r.share, 0)).toBe(100)
  })

  it('breakdown: bo\'sh ro\'yxatda 0 ulush', () => {
    expect(breakdown([], ['rent'] as const, (t) => t.category as 'rent')[0].share).toBe(0)
  })

  it('sourceStats: soni, ulushi va konversiyasi', () => {
    const stats = sourceStats(
      [customer({ source: 'instagram', status: 'active' }), customer({ source: 'instagram', status: 'lead' }), customer({ source: 'telegram' })],
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
