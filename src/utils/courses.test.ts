import { describe, expect, it } from 'vitest'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import { courseChoices, courseStats, normalizeCourseName, usedByCustomers, validateCourse } from './courses'

const course = (patch: Partial<Course> = {}): Course => ({
  id: 'k1',
  name: 'IELTS',
  type: 'course',
  durationMonths: 6,
  monthlyPrice: 650_000,
  activeGroups: 2,
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
  it('courseStats: talabalar — faqat "To\'lov qildi", lidlar — barcha bosqichlar, tushum = talabalar × narx', () => {
    const list = [
      customer({ id: 'a', status: 'paid' }),
      customer({ id: 'b', status: 'paid' }),
      customer({ id: 'c', status: 'new' }),
      customer({ id: 'd', status: 'cancelled' }),
      customer({ id: 'e', course: 'Python' }),
    ]
    expect(courseStats(course(), list)).toEqual({ students: 2, leads: 4, expectedMonthly: 1_300_000 })
    expect(courseStats(course({ monthlyPrice: 0 }), list).expectedMonthly).toBe(0)
    expect(usedByCustomers(course({ name: 'Rus tili' }), list)).toBe(0)
  })

  it('validateCourse: nom, takror, davomiylik, narx, guruhlar', () => {
    const base = { name: 'Python', type: 'course', durationMonths: 4, monthlyPrice: 900_000, activeGroups: 1, status: 'active' } as const
    expect(validateCourse(base, [course()])).toEqual({})
    expect(validateCourse({ ...base, name: ' ielts ' }, [course()]).name).toBe('Bu nomdagi kurs yoki xizmat bor')
    expect(validateCourse({ ...base, name: 'IELTS' }, [course()], 'k1')).toEqual({})
    expect(validateCourse({ ...base, name: 'A' }, []).name).toBeDefined()
    expect(validateCourse({ ...base, durationMonths: 0 }, []).durationMonths).toBeDefined()
    expect(validateCourse({ ...base, durationMonths: Number.NaN }, []).durationMonths).toBeDefined()
    expect(validateCourse({ ...base, monthlyPrice: -1 }, []).monthlyPrice).toBeDefined()
    expect(validateCourse({ ...base, activeGroups: 1.5 }, []).activeGroups).toBeDefined()
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
