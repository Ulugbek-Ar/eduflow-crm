import type { Course } from '../types/course.types'
import type { Settings } from '../types/dashboard.types'

export const COURSES = [
  'Ingliz tili (IELTS)',
  'Frontend dasturlash',
  'Python asoslari',
  'Matematika (DTM)',
  'Rus tili',
  'Grafik dizayn',
] as const

export const DEFAULT_SETTINGS: Settings = {
  orgName: 'EduFlow Academy',
  // Tashkilot nomining bosh harflari (Sidebar'dagi logo)
  logoText: 'EA',
  logoImage: '',
  phone: '+998 71 200 00 00',
  address: 'Toshkent sh., Chilonzor tumani',
  currency: 'UZS',
  dateFormat: 'dd.mm.yyyy',
  csvDelimiter: ';',
  adminLogin: 'admin',
  profileName: '',
  profileRole: 'Administrator',
}

// [nom, turi, davomiyligi (oy), oylik narx, faol guruhlar (v10 dan qolgan; guruhlar bo'limidan hisoblanadi), holati]
type CourseSeed = [string, Course['type'], number, number, number, Course['status']]

const COURSE_SEED: CourseSeed[] = [
  [COURSES[0], 'course', 6, 650_000, 2, 'active'],
  [COURSES[1], 'course', 8, 1_200_000, 1, 'active'],
  [COURSES[2], 'course', 4, 900_000, 1, 'active'],
  [COURSES[3], 'course', 9, 500_000, 2, 'active'],
  [COURSES[4], 'course', 6, 450_000, 1, 'active'],
  [COURSES[5], 'course', 5, 800_000, 0, 'active'],
  ['Individual konsultatsiya', 'service', 1, 300_000, 0, 'active'],
  ['Koreys tili', 'course', 6, 600_000, 0, 'archived'],
]

// Demo kurslar (id: k1...k8). base — demo tarixining boshlanishi (kurslar undan oldin yaratilgan)
export function createMockCourses(base = new Date()): Course[] {
  return COURSE_SEED.map(([name, type, durationMonths, monthlyPrice, activeGroups, status], index) => {
    const createdAt = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 300 + index * 7, 10, 0)
    return {
      id: `k${index + 1}`,
      name,
      type,
      durationMonths,
      monthlyPrice,
      activeGroups,
      status,
      createdAt: createdAt.toISOString(),
    }
  })
}
