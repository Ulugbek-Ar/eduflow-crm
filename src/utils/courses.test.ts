import { describe, expect, it } from 'vitest'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import { courseChoices, courseStats, coursesNeedingSetup, durationLabel, normalizeCourseName, usedByCustomers, validateCourse } from './courses'

const course = (patch: Partial<Course> = {}): Course => ({
  id: 'k1',
  name: 'IELTS',
  type: 'course',
  durationMonths: 6,
  monthlyPrice: 650_000,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...patch,
})

const customer = (patch: Partial<Customer>): Customer => ({
  id: 'c1',
  name: 'Aziza',
  phone: '+998 90 000 00 00',
  course: 'IELTS',
  status: 'paid',
  source: 'instagram',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...patch,
})

describe('kurslar', () => {
  it('courseStats (v11): guruh bo\'lsa — guruhda o\'qiyotganlar, chegirma va individual narx bilan; pauzadagilar hisoblanmaydi', () => {
    const groups = [{ id: 'g1', name: 'IELTS', courseId: 'k1', room: '', days: ['mon' as const], startTime: '09:00', endTime: '10:30', capacity: 12, startDate: '2026-01-01', status: 'active' as const, createdAt: '2026-01-01T00:00:00.000Z' }]
    const base = { groupId: 'g1', startDate: '2026-09-01', status: 'active' as const, createdAt: '2026-09-01T00:00:00.000Z' }
    const enrollments = [
      { ...base, id: 'e1', customerId: 'a' },
      { ...base, id: 'e2', customerId: 'b', discountPercent: 10 },
      { ...base, id: 'e3', customerId: 'c', priceOverride: 500_000 },
      { ...base, id: 'e4', customerId: 'd', status: 'paused' as const, pausedFrom: '2026-11-01', pausedTo: '2026-11-30' },
      { ...base, id: 'e5', customerId: 'e', status: 'left' as const, endDate: '2026-10-15' },
    ]
    const stats = courseStats(course(), [customer({ id: 'a' })], groups, enrollments, '2026-11-07')
    expect(stats).toEqual({ students: 3, leads: 1, expectedMonthly: 650_000 + 585_000 + 500_000, groups: 1 })
  })

  it('courseStats: talabalar — faqat "To\'lov qildi", lidlar — barcha bosqichlar, tushum = talabalar × narx', () => {
    const list = [
      customer({ id: 'a', status: 'paid' }),
      customer({ id: 'b', status: 'paid' }),
      customer({ id: 'c', status: 'new' }),
      customer({ id: 'd', status: 'cancelled' }),
      customer({ id: 'e', course: 'Python' }),
    ]
    expect(courseStats(course(), list)).toEqual({ students: 2, leads: 4, expectedMonthly: 1_300_000, groups: 0 })
    expect(courseStats(course({ monthlyPrice: 0 }), list).expectedMonthly).toBe(0)
    expect(usedByCustomers(course({ name: 'Rus tili' }), list)).toBe(0)
  })

  it('validateCourse: nom, takror, davomiylik, narx', () => {
    const base = { name: 'Python', type: 'course', durationMonths: 4, monthlyPrice: 900_000, status: 'active' } as const
    expect(validateCourse(base, [course()])).toEqual({})
    expect(validateCourse({ ...base, name: ' ielts ' }, [course()]).name).toBe('Bu nomdagi kurs yoki xizmat bor')
    expect(validateCourse({ ...base, name: 'IELTS' }, [course()], 'k1')).toEqual({})
    expect(validateCourse({ ...base, name: 'A' }, []).name).toBeDefined()
    expect(validateCourse({ ...base, durationMonths: 0 }, [])).toEqual({}) // 0 — muddatsiz
    expect(validateCourse({ ...base, durationMonths: -1 }, []).durationMonths).toBeDefined()
    expect(validateCourse({ ...base, durationMonths: 61 }, []).durationMonths).toBeDefined()
    expect(validateCourse({ ...base, durationMonths: Number.NaN }, []).durationMonths).toBeDefined()
    expect(validateCourse({ ...base, monthlyPrice: -1 }, []).monthlyPrice).toBeDefined()
  })

  it('courseChoices: faqat faol kurslar, tahrirlashda arxivdagi joriy kurs ham', () => {
    const list = [course(), course({ id: 'k2', name: 'Koreys tili', status: 'archived' })]
    expect(courseChoices(list)).toEqual(['IELTS'])
    expect(courseChoices(list, 'Koreys tili')).toEqual(['IELTS', 'Koreys tili'])
    expect(courseChoices(list, 'IELTS')).toEqual(['IELTS'])
  })

  it('normalizeCourseName ortiqcha bo\'shliqlarni olib tashlaydi', () => {
    expect(normalizeCourseName('  Ingliz   tili ')).toBe('Ingliz tili')
  })
})

describe('muddatsiz kurslar', () => {
  it('davomiylik 0 — "Muddatsiz"; narx yoki muddat kiritilmagan faol kurslar ro\'yxati', () => {
    expect(durationLabel(0)).toBe('Muddatsiz')
    expect(durationLabel(6)).toBe('6 oy')
    const list = [course(), course({ id: 'k2', durationMonths: 0 }), course({ id: 'k3', monthlyPrice: 0 }), course({ id: 'k4', monthlyPrice: 0, status: 'archived' })]
    expect(coursesNeedingSetup(list).map((c) => c.id)).toEqual(['k2', 'k3'])
  })
})
