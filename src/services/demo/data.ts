// Demo markaz ma'lumoti (alohida bo'lak: generator faqat demo ochilganda yuklanadi — landing va ilovaning
// boshlang'ich JS hajmiga qo'shilmaydi)
import { DEFAULT_SETTINGS } from '../../constants/mockData'
import type { StoredData } from '../storage.service'
import { withDemoBranches } from './branches'
import { generateDemo } from './generator'

export function createMockData(now: Date = new Date()): StoredData {
  const { customers, transactions, courses, teachers, groups, enrollments, attendance, lessonExceptions } = generateDemo(now)
  return withDemoBranches({ customers, transactions, courses, settings: { ...DEFAULT_SETTINGS }, teachers, groups, enrollments, attendance, lessonExceptions }, now)
}
