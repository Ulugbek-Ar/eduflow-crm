import type { Course } from '../types/course.types'
import type { Customer, CustomerSource, CustomerStatus } from '../types/customer.types'
import type { Settings } from '../types/dashboard.types'
import type { PaymentMethod, Transaction, TransactionCategory, TransactionStatus, TransactionType } from '../types/finance.types'

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

// [nom, turi, davomiyligi (oy), oylik narx, faol guruhlar, holati]
type CourseSeed = [string, Course['type'], number, number, number, Course['status']]

const COURSE_SEED: CourseSeed[] = [
  [COURSES[0], 'course', 6, 650_000, 3, 'active'],
  [COURSES[1], 'course', 8, 1_200_000, 2, 'active'],
  [COURSES[2], 'course', 4, 900_000, 2, 'active'],
  [COURSES[3], 'course', 9, 500_000, 4, 'active'],
  [COURSES[4], 'course', 6, 450_000, 1, 'active'],
  [COURSES[5], 'course', 5, 800_000, 1, 'active'],
  ['Individual konsultatsiya', 'service', 1, 300_000, 0, 'active'],
  ['Koreys tili', 'course', 6, 600_000, 0, 'archived'],
]

export function createMockCourses(): Course[] {
  return COURSE_SEED.map(([name, type, durationMonths, monthlyPrice, activeGroups, status], index) => ({
    id: `k${index + 1}`,
    name,
    type,
    durationMonths,
    monthlyPrice,
    activeGroups,
    status,
    createdAt: daysAgo(200 - index),
  }))
}

// Sanalar "hozir"ga nisbatan hisoblanadi, shunda demo ma'lumotlar doim oxirgi 6 oyni qamrab oladi
function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(10, 0, 0, 0)
  return date.toISOString()
}

type CustomerSeed = [string, string, number, CustomerStatus, CustomerSource, number]

const CUSTOMER_SEED: CustomerSeed[] = [
  ['Aziza Karimova', '+998 90 123 45 67', 0, 'paid', 'instagram', 170],
  ['Jasur Toshmatov', '+998 91 234 56 78', 1, 'paid', 'telegram', 160],
  ['Dilnoza Rahimova', '+998 93 345 67 89', 3, 'cancelled', 'referral', 150],
  ['Sardor Yusupov', '+998 94 456 78 90', 2, 'paid', 'website', 130],
  ['Madina Abdullayeva', '+998 99 567 89 01', 4, 'thinking', 'instagram', 115],
  ['Bekzod Ergashev', '+998 97 678 90 12', 1, 'paid', 'telegram', 100],
  ['Nilufar Qodirova', '+998 90 789 01 23', 5, 'paid', 'instagram', 85],
  ['Otabek Nazarov', '+998 88 890 12 34', 0, 'thinking', 'website', 70],
  ['Shahnoza Mirzayeva', '+998 95 901 23 45', 3, 'paid', 'referral', 55],
  ['Doniyor Saidov', '+998 33 012 34 56', 2, 'paid', 'telegram', 40],
  ['Kamola Xasanova', '+998 90 111 22 33', 0, 'paid', 'instagram', 25],
  ['Rustam Aliyev', '+998 91 222 33 44', 1, 'contacted', 'telegram', 14],
  ['Gulnoza Ismoilova', '+998 93 333 44 55', 5, 'paid', 'website', 8],
  ['Javohir Umarov', '+998 94 444 55 66', 2, 'contacted', 'instagram', 3],
  ['Malika Sobirova', '+998 99 555 66 77', 4, 'new', 'referral', 0],
]

// [tur, summa, to'lov turi, kategoriya, izoh, mijoz raqami (1 dan) yoki 0, necha kun oldin, status?, marketing manbasi?]
type TransactionSeed = [TransactionType, number, PaymentMethod, TransactionCategory, string, number, number, TransactionStatus?, CustomerSource?]

const TRANSACTION_SEED: TransactionSeed[] = [
  ['income', 650_000, 'card', 'course_fee', 'IELTS - 1-oy to\'lovi', 1, 168],
  ['income', 1_200_000, 'card', 'course_fee', 'Frontend - 1-oy to\'lovi', 2, 158],
  ['expense', 2_000_000, 'transfer', 'rent', 'Xona ijarasi', 0, 150],
  ['income', 500_000, 'cash', 'course_fee', 'Matematika - 1-oy to\'lovi', 3, 148],
  ['income', 650_000, 'card', 'course_fee', 'IELTS - 2-oy to\'lovi', 1, 138],
  ['expense', 350_000, 'card', 'utilities', 'Elektr va internet', 0, 135],
  ['income', 900_000, 'card', 'course_fee', 'Python - 1-oy to\'lovi', 4, 128],
  ['expense', 3_000_000, 'transfer', 'salary', 'O\'qituvchilar maoshi', 0, 120],
  ['income', 1_200_000, 'transfer', 'course_fee', 'Frontend - 2-oy to\'lovi', 2, 118],
  ['income', 450_000, 'cash', 'course_fee', 'Rus tili - 1-oy to\'lovi', 5, 112],
  ['income', 1_200_000, 'card', 'course_fee', 'Frontend - 1-oy to\'lovi', 6, 98],
  ['expense', 2_000_000, 'transfer', 'rent', 'Xona ijarasi', 0, 90],
  ['income', 800_000, 'card', 'course_fee', 'Grafik dizayn - 1-oy to\'lovi', 7, 83],
  ['expense', 800_000, 'card', 'marketing', 'Instagram reklama', 0, 75, 'paid', 'instagram'],
  ['income', 900_000, 'card', 'course_fee', 'Python - 3-oy to\'lovi (qaytarildi)', 4, 45, 'cancelled'],
  ['expense', 500_000, 'card', 'marketing', 'Telegram kanalda reklama', 0, 28, 'paid', 'telegram'],
  ['expense', 300_000, 'card', 'marketing', 'Instagram target reklama', 0, 7, 'paid', 'instagram'],
  ['income', 900_000, 'card', 'course_fee', 'Python - 2-oy to\'lovi', 4, 68],
  ['income', 400_000, 'cash', 'other_income', 'Ochiq dars (master-klass)', 0, 64],
  ['expense', 3_000_000, 'transfer', 'salary', 'O\'qituvchilar maoshi', 0, 60],
  ['income', 500_000, 'cash', 'course_fee', 'Matematika - 1-oy to\'lovi', 9, 53],
  ['income', 900_000, 'card', 'course_fee', 'Python - 1-oy to\'lovi', 10, 38],
  ['expense', 2_000_000, 'transfer', 'rent', 'Xona ijarasi', 0, 30],
  ['income', 650_000, 'card', 'course_fee', 'IELTS - 1-oy to\'lovi', 11, 23],
  ['income', 1_200_000, 'card', 'course_fee', 'Frontend - 2-oy to\'lovi', 6, 20],
  ['expense', 380_000, 'card', 'utilities', 'Elektr va internet', 0, 15],
  ['income', 800_000, 'card', 'course_fee', 'Grafik dizayn - 2-oy to\'lovi', 7, 12],
  ['expense', 600_000, 'cash', 'equipment', 'Ofis jihozlari', 0, 9],
  ['income', 800_000, 'cash', 'course_fee', 'Grafik dizayn - 1-oy to\'lovi', 13, 6],
  ['income', 900_000, 'card', 'course_fee', 'Python - 2-oy to\'lovi', 10, 4],
  ['income', 650_000, 'card', 'course_fee', 'IELTS - 2-oy to\'lovi', 11, 0],
  ['income', 1_200_000, 'transfer', 'course_fee', 'Frontend - 3-oy to\'lovi (kutilmoqda)', 6, 1, 'pending'],
  ['income', 600_000, 'cash', 'course_fee', 'Grafik dizayn - qisman to\'lov', 13, 1],
]

export function createMockCustomers(): Customer[] {
  return CUSTOMER_SEED.map(([name, phone, courseIndex, status, source, days], index) => ({
    id: `c${index + 1}`,
    name,
    phone,
    course: COURSES[courseIndex],
    status,
    source,
    createdAt: daysAgo(days),
  }))
}

export function createMockTransactions(): Transaction[] {
  return TRANSACTION_SEED.map(([type, amount, method, category, note, customerNo, days, status = 'paid', source], index) => ({
    id: `t${index + 1}`,
    type,
    amount,
    method,
    category,
    note,
    customerId: customerNo > 0 ? `c${customerNo}` : undefined,
    customerName: customerNo > 0 ? CUSTOMER_SEED[customerNo - 1][0] : undefined,
    status,
    source,
    date: daysAgo(days),
  }))
}
