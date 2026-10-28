import type { Customer, CustomerSource, CustomerStatus } from '../types/customer.types'
import type { Settings } from '../types/dashboard.types'
import type { PaymentMethod, Transaction, TransactionCategory, TransactionType } from '../types/finance.types'

export const COURSES = [
  'Ingliz tili (IELTS)',
  'Frontend dasturlash',
  'Python asoslari',
  'Matematika (DTM)',
  'Rus tili',
  'Grafik dizayn',
] as const

export const DEFAULT_SETTINGS: Settings = {
  orgName: 'Apex Academy',
  logoText: 'AA',
  phone: '+998 71 200 00 00',
  address: 'Toshkent sh., Chilonzor tumani',
  currency: 'UZS',
  dateFormat: 'dd.mm.yyyy',
  csvDelimiter: ';',
  adminLogin: 'admin',
  courses: [...COURSES],
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
  ['Aziza Karimova', '+998 90 123 45 67', 0, 'active', 'instagram', 170],
  ['Jasur Toshmatov', '+998 91 234 56 78', 1, 'active', 'telegram', 160],
  ['Dilnoza Rahimova', '+998 93 345 67 89', 3, 'left', 'referral', 150],
  ['Sardor Yusupov', '+998 94 456 78 90', 2, 'active', 'website', 130],
  ['Madina Abdullayeva', '+998 99 567 89 01', 4, 'paused', 'instagram', 115],
  ['Bekzod Ergashev', '+998 97 678 90 12', 1, 'active', 'telegram', 100],
  ['Nilufar Qodirova', '+998 90 789 01 23', 5, 'active', 'instagram', 85],
  ['Otabek Nazarov', '+998 88 890 12 34', 0, 'lead', 'website', 70],
  ['Shahnoza Mirzayeva', '+998 95 901 23 45', 3, 'active', 'referral', 55],
  ['Doniyor Saidov', '+998 33 012 34 56', 2, 'active', 'telegram', 40],
  ['Kamola Xasanova', '+998 90 111 22 33', 0, 'active', 'instagram', 25],
  ['Rustam Aliyev', '+998 91 222 33 44', 1, 'lead', 'telegram', 14],
  ['Gulnoza Ismoilova', '+998 93 333 44 55', 5, 'active', 'website', 8],
  ['Javohir Umarov', '+998 94 444 55 66', 2, 'lead', 'instagram', 3],
  ['Malika Sobirova', '+998 99 555 66 77', 4, 'lead', 'referral', 0],
]

// [tur, summa, usul, kategoriya, izoh, mijoz raqami (1 dan) yoki 0, necha kun oldin]
type TransactionSeed = [TransactionType, number, PaymentMethod, TransactionCategory, string, number, number]

const TRANSACTION_SEED: TransactionSeed[] = [
  ['income', 650_000, 'payme', 'course_fee', 'IELTS - 1-oy to\'lovi', 1, 168],
  ['income', 1_200_000, 'click', 'course_fee', 'Frontend - 1-oy to\'lovi', 2, 158],
  ['expense', 2_000_000, 'bank', 'rent', 'Xona ijarasi', 0, 150],
  ['income', 500_000, 'cash', 'course_fee', 'Matematika - 1-oy to\'lovi', 3, 148],
  ['income', 650_000, 'payme', 'course_fee', 'IELTS - 2-oy to\'lovi', 1, 138],
  ['expense', 350_000, 'click', 'utilities', 'Elektr va internet', 0, 135],
  ['income', 900_000, 'click', 'course_fee', 'Python - 1-oy to\'lovi', 4, 128],
  ['expense', 3_000_000, 'bank', 'salary', 'O\'qituvchilar maoshi', 0, 120],
  ['income', 1_200_000, 'bank', 'course_fee', 'Frontend - 2-oy to\'lovi', 2, 118],
  ['income', 450_000, 'cash', 'course_fee', 'Rus tili - 1-oy to\'lovi', 5, 112],
  ['income', 1_200_000, 'payme', 'course_fee', 'Frontend - 1-oy to\'lovi', 6, 98],
  ['expense', 2_000_000, 'bank', 'rent', 'Xona ijarasi', 0, 90],
  ['income', 800_000, 'click', 'course_fee', 'Grafik dizayn - 1-oy to\'lovi', 7, 83],
  ['expense', 800_000, 'click', 'marketing', 'Instagram reklama', 0, 75],
  ['income', 900_000, 'payme', 'course_fee', 'Python - 2-oy to\'lovi', 4, 68],
  ['income', 400_000, 'cash', 'other_income', 'Ochiq dars (master-klass)', 0, 64],
  ['expense', 3_000_000, 'bank', 'salary', 'O\'qituvchilar maoshi', 0, 60],
  ['income', 500_000, 'cash', 'course_fee', 'Matematika - 1-oy to\'lovi', 9, 53],
  ['income', 900_000, 'click', 'course_fee', 'Python - 1-oy to\'lovi', 10, 38],
  ['expense', 2_000_000, 'bank', 'rent', 'Xona ijarasi', 0, 30],
  ['income', 650_000, 'payme', 'course_fee', 'IELTS - 1-oy to\'lovi', 11, 23],
  ['income', 1_200_000, 'click', 'course_fee', 'Frontend - 2-oy to\'lovi', 6, 20],
  ['expense', 380_000, 'click', 'utilities', 'Elektr va internet', 0, 15],
  ['income', 800_000, 'payme', 'course_fee', 'Grafik dizayn - 2-oy to\'lovi', 7, 12],
  ['expense', 600_000, 'cash', 'equipment', 'Ofis jihozlari', 0, 9],
  ['income', 800_000, 'cash', 'course_fee', 'Grafik dizayn - 1-oy to\'lovi', 13, 6],
  ['income', 900_000, 'click', 'course_fee', 'Python - 2-oy to\'lovi', 10, 4],
  ['income', 650_000, 'payme', 'course_fee', 'IELTS - 2-oy to\'lovi', 11, 0],
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
  return TRANSACTION_SEED.map(([type, amount, method, category, note, customerNo, days], index) => ({
    id: `t${index + 1}`,
    type,
    amount,
    method,
    category,
    note,
    customerId: customerNo > 0 ? `c${customerNo}` : undefined,
    date: daysAgo(days),
  }))
}
