import { describe, expect, it } from 'vitest'
import { attributeIncome } from './attribution'
import type { AttributionContext } from './attribution'

const at = '2026-08-01T00:00:00.000Z'
const ctx = (course: string): AttributionContext => ({
  customers: [{ id: 'c1', name: 'Aka', phone: '', course, status: 'paid', source: 'website', createdAt: at }],
  courses: [{ id: 'k1', name: 'Matematika', type: 'course', durationMonths: 0, monthlyPrice: 500_000, status: 'active', createdAt: at }],
  groups: [{ id: 'g1', name: 'M-1', courseId: 'k1', room: '', days: ['mon'], startTime: '09:00', endTime: '10:00', capacity: 10, startDate: '2026-08-01', status: 'active', createdAt: at }],
  enrollments: [{ id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-09-01', status: 'active', createdAt: at }],
} as AttributionContext)
const income = { type: 'income' as const, category: 'course_fee' as const, customerId: 'c1', date: '2026-11-05T10:00:00.000Z' }

describe('kirimni o\'qishga bog\'lash', () => {
  it('kurs nomi bo\'yicha', () => expect(attributeIncome(income, ctx('Matematika'))?.id).toBe('e1'))
  it('N-1: mijoz kursi guruh kursidan farq qilsa ham faol o\'qishga bog\'lanadi (pul yo\'qolmaydi)', () => {
    expect(attributeIncome(income, ctx('Ingliz tili'))?.id).toBe('e1')
  })
})
