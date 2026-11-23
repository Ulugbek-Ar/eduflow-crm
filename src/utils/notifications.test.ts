import { describe, expect, it } from 'vitest'
import { buildNotifications } from './notifications'
import type { Transaction } from '../types/finance.types'

const tx = (patch: Partial<Transaction>): Transaction =>
  ({ id: 't1', type: 'income', amount: 650_000, method: 'card', category: 'other_income', note: '', status: 'paid', date: '2026-11-20T10:00:00.000Z', ...patch }) as Transaction

describe('bildirishnomalar', () => {
  it('N-1: bog\'lanmagan onlayn to\'lov administratorga ko\'rinadi (moliya ruxsati bilan)', () => {
    const money = (n: number) => `${n} so'm`
    const list = buildNotifications([], [tx({ provider: 'payme' }), tx({ id: 't2', provider: 'payme', customerId: 'c1' })], 0, money)
    expect(list.find((n) => n.id.startsWith('unassigned:'))).toMatchObject({ tone: 'danger', target: 'finance', id: 'unassigned:t1' })
    const noFinance = buildNotifications([], [tx({ provider: 'payme' })], 0, money, [], new Date(), { groups: [], enrollments: [], attendance: [], lessonExceptions: [], finance: false })
    expect(noFinance.some((n) => n.id.startsWith('unassigned:'))).toBe(false)
  })
})
