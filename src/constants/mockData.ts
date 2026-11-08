import type { Course } from '../types/course.types'
import type { Settings } from '../types/dashboard.types'

// Demo markazdagi o'qituvchi xodim (users.service DEMO_STAFF dagi 5-xodim) — demo o'qituvchi yozuviga bog'langan
export const DEMO_TEACHER_USER_ID = 'demo-u5'

export const COURSES = [
  'Ingliz tili (IELTS)',
  'Frontend dasturlash',
  'Python asoslari',
  'Matematika (DTM)',
  'Rus tili',
  'Grafik dizayn',
] as const

// Qarz eslatmasi shablonlari (Sozlamalar -> Eslatmalar'da o'zgartiriladi)
export const DEFAULT_REMINDER_UZ =
  'Assalomu alaykum, {ism}! {markaz}: «{guruh}» guruhi bo\'yicha {oy} oyi to\'lovi — {summa}. Iltimos, to\'lovni amalga oshiring. Savollar bo\'lsa: {telefon}'
export const DEFAULT_REMINDER_RU =
  'Здравствуйте, {ism}! {markaz}: оплата за {oy}, группа «{guruh}» — {summa}. Пожалуйста, внесите оплату. Вопросы: {telefon}'

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
  attendanceEditDays: 3,
  prorateFirstMonth: false,
  paymentDueDay: 10,
  reminderTemplateUz: DEFAULT_REMINDER_UZ,
  reminderTemplateRu: DEFAULT_REMINDER_RU,
  paymeMerchantId: '',
  clickServiceId: '',
  clickMerchantId: '',
  smsSender: '',
  autoReminders: false,
  autoRemindEveryDays: 7,
  autoRemindLang: 'uz',
  telegramBot: '',
  botAbsenceAlerts: true,
  botPaymentAlerts: true,
}

// [nom, turi, davomiyligi (oy), oylik narx, holati]
type CourseSeed = [string, Course['type'], number, number, Course['status']]

const COURSE_SEED: CourseSeed[] = [
  [COURSES[0], 'course', 6, 650_000, 'active'],
  [COURSES[1], 'course', 8, 1_200_000, 'active'],
  [COURSES[2], 'course', 4, 900_000, 'active'],
  [COURSES[3], 'course', 9, 500_000, 'active'],
  [COURSES[4], 'course', 6, 450_000, 'active'],
  [COURSES[5], 'course', 5, 800_000, 'active'],
  ['Individual konsultatsiya', 'service', 1, 300_000, 'active'],
  ['Koreys tili', 'course', 6, 600_000, 'archived'],
]

// Demo kurslar (id: k1...k8). base — demo tarixining boshlanishi (kurslar undan oldin yaratilgan)
export function createMockCourses(base = new Date()): Course[] {
  return COURSE_SEED.map(([name, type, durationMonths, monthlyPrice, status], index) => {
    const createdAt = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 300 + index * 7, 10, 0)
    return {
      id: `k${index + 1}`,
      name,
      type,
      durationMonths,
      monthlyPrice,
      status,
      createdAt: createdAt.toISOString(),
    }
  })
}
