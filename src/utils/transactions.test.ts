import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types/finance.types'
import { mergeRemote } from './transactions'

const tx = (patch: Partial<Transaction>): Transaction => ({
  id: 't1',
  type: 'income',
  amount: 650_000,
  method: 'card',
  category: 'course_fee',
  note: '',
  status: 'paid',
  date: '2026-11-08T09:00:00.000Z',
  ...patch,
})

describe('serverdagi onlayn to\'lovlarni birlashtirish', () => {
  it('yangisi qo\'shiladi (sanasi bo\'yicha boshida), o\'zgargani almashtiriladi, o\'zgarmagani — o\'sha obyekt', () => {
    const local = tx({ id: 'a', note: 'mahalliy' })
    const payme = tx({ id: 'p1', provider: 'payme', providerRef: 'pm-1', updatedAt: '2026-11-08T09:00:01.000Z' })
    const list = [payme, local]
    expect(mergeRemote(list, [])).toBe(list)
    expect(mergeRemote(list, [{ ...payme }])).toBe(list)
    const cancelled = { ...payme, status: 'cancelled' as const, updatedAt: '2026-11-08T10:00:00.000Z' }
    const fresh = tx({ id: 'p2', provider: 'click', providerRef: '9001', date: '2026-11-08T11:00:00.000Z', updatedAt: '2026-11-08T11:00:00.000Z' })
    const merged = mergeRemote(list, [cancelled, fresh])
    expect(merged.map((t) => [t.id, t.status])).toEqual([['p2', 'paid'], ['p1', 'cancelled'], ['a', 'paid']])
    expect(merged[2]).toBe(local)
  })
})
