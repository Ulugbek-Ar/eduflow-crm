import { describe, expect, it } from 'vitest'
import { receiptCashier } from './receipt'
import type { Transaction } from '../types/finance.types'

const tx = (patch: Partial<Transaction>) => ({ id: 't1', type: 'income', amount: 1, method: 'card', category: 'course_fee', note: '', status: 'paid', date: '', ...patch }) as Transaction

describe('QA-21: chekda "Qabul qildi"', () => {
  it('onlayn to\'lovda — provayder; jurnalda bo\'lsa — xodim; aks holda bo\'sh', () => {
    expect(receiptCashier(tx({ provider: 'payme' }), [])).toBe('Payme (onlayn)')
    expect(receiptCashier(tx({ provider: 'click' }), [])).toBe('Click (onlayn)')
    expect(receiptCashier(tx({}), [{ action: 'payment.create', entityId: 't1', userName: 'Kassir' } as never])).toBe('Kassir')
    expect(receiptCashier(tx({}), [])).toBe('')
  })
})
