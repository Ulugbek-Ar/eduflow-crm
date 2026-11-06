import { tr } from '../i18n'
import type { Course, CourseInput } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import { COURSE_LIMITS } from './guards'

export const COURSE_TYPE_LABELS: Record<Course['type'], string> = { course: tr('Kurs'), service: tr('Xizmat') }
export const COURSE_STATUS_LABELS: Record<Course['status'], string> = { active: tr('Faol'), archived: tr('Arxiv') }

export type CourseFormErrors = Partial<Record<'name' | 'durationMonths' | 'monthlyPrice' | 'activeGroups', string>>

export function normalizeCourseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function validateCourse(input: CourseInput, existing: readonly Course[], editingId?: string): CourseFormErrors {
  const errors: CourseFormErrors = {}
  const name = normalizeCourseName(input.name)
  if (name.length < 2) errors.name = tr('Nomini kiriting (kamida 2 ta belgi)')
  else if (existing.some((c) => c.id !== editingId && c.name.toLowerCase() === name.toLowerCase())) errors.name = tr('Bu nomdagi kurs yoki xizmat bor')
  if (!Number.isInteger(input.durationMonths) || input.durationMonths < 0 || input.durationMonths > COURSE_LIMITS.maxDuration) {
    errors.durationMonths = tr('0 dan {0} oygacha (0 — muddatsiz)', { 0: COURSE_LIMITS.maxDuration })
  }
  if (!Number.isInteger(input.monthlyPrice) || input.monthlyPrice < 0 || input.monthlyPrice > COURSE_LIMITS.maxPrice) {
    errors.monthlyPrice = tr('Narx 0 yoki musbat butun son bo\'lishi kerak')
  }
  if (!Number.isInteger(input.activeGroups) || input.activeGroups < 0 || input.activeGroups > COURSE_LIMITS.maxGroups) {
    errors.activeGroups = tr('0 dan {0} gacha', { 0: COURSE_LIMITS.maxGroups })
  }
  return errors
}

export interface CourseStats {
  // "To'lov qildi" bosqichidagi mijozlar
  students: number
  // Shu kursni tanlagan barcha mijozlar (voronkaning istalgan bosqichida)
  leads: number
  // Oylik kutilayotgan tushum = talabalar × oylik narx
  expectedMonthly: number
}

export function courseStats(course: Course, customers: readonly Customer[]): CourseStats {
  const own = customers.filter((c) => c.course === course.name)
  const students = own.filter((c) => c.status === 'paid').length
  return { students, leads: own.length, expectedMonthly: students * course.monthlyPrice }
}

export function findCourse(courses: readonly Course[], name: string): Course | undefined {
  return courses.find((c) => c.name === name)
}

// Mijoz formasi uchun: faol kurslar + (tahrirlashda) mijozning hozirgi kursi, arxivda bo'lsa ham
export function courseChoices(courses: readonly Course[], current = ''): string[] {
  const names = courses.filter((c) => c.status === 'active').map((c) => c.name)
  return current && !names.includes(current) ? [...names, current] : names
}

// Davomiylik matni: 0 — muddatsiz
export function durationLabel(months: number): string {
  return months > 0 ? tr('{0} oy', { 0: months }) : tr('Muddatsiz')
}

// Qarz va kutilayotgan tushum to'g'ri hisoblanishi uchun to'ldirilishi kerak bo'lgan faol kurslar
export function coursesNeedingSetup(courses: readonly Course[]): Course[] {
  return courses.filter((c) => c.status === 'active' && (c.monthlyPrice <= 0 || c.durationMonths <= 0))
}

export function usedByCustomers(course: Course, customers: readonly Customer[]): number {
  return customers.filter((c) => c.course === course.name).length
}
