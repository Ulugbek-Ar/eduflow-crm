import { describe, expect, it } from 'vitest'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { globalSearch, SEARCH_LIMITS } from './search'

const customer = (id: string, name: string, phone = '+998 90 000 00 00'): Customer => ({
  id,
  name,
  phone,
  course: 'IELTS',
  status: 'new',
  source: 'instagram',
  createdAt: '2026-01-01T00:00:00.000Z',
})
const course: Course = { id: 'k1', name: 'Python asoslari', type: 'course', durationMonths: 4, monthlyPrice: 900_000, activeGroups: 1, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
const tx = (id: string, note: string, date: string, customerId?: string): Transaction => ({
  id,
  type: 'income',
  amount: 1,
  method: 'cash',
  category: 'course_fee',
  note,
  customerId,
  status: 'paid',
  date,
})
const names = (id?: string) => (id === 'c1' ? 'Aziza Karimova' : '—')

describe('globalSearch', () => {
  it('mijoz (ism, telefon), kurs va tranzaksiya (izoh, mijoz ismi) bo\'yicha', () => {
    const result = globalSearch('aziza', [customer('c1', 'Aziza Karimova'), customer('c2', 'Bobur')], [course], [tx('t1', 'Fevral', '2026-02-01', 'c1')], names)
    expect(result.customers.map((c) => c.id)).toEqual(['c1'])
    expect(result.transactions.map((t) => t.id)).toEqual(['t1'])
    expect(globalSearch('python', [], [course], [], names).courses).toHaveLength(1)
    expect(globalSearch('90 111', [customer('c3', 'Vali', '+998 90 111 22 33')], [], [], names).customers).toHaveLength(1)
  })

  it('kamida 2 belgi; natijalar cheklanadi, umumiy soni saqlanadi; tranzaksiyalar yangisidan', () => {
    expect(globalSearch('a', [customer('c1', 'Aziza')], [], [], names).total).toBe(0)
    const many = Array.from({ length: 8 }, (_, i) => customer(`c${i}`, `Ali ${i}`))
    const result = globalSearch('ali', many, [], [tx('t1', 'Ali eski', '2026-01-01'), tx('t2', 'Ali yangi', '2026-03-01')], names)
    expect(result.customers).toHaveLength(SEARCH_LIMITS.customers)
    expect(result.total).toBe(10)
    expect(result.transactions.map((t) => t.id)).toEqual(['t2', 't1'])
  })
})
