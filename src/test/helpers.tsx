// Komponent testlari uchun umumiy yordamchilar: ma'lumotni oldindan yozish va ilovani chizish
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach } from 'vitest'
import App from '../App'
import { COURSES, createMockCourses } from '../constants/mockData'
import { hashPassword, PBKDF2_ITERATIONS } from '../services/auth.service'
import { createEmptyData, saveAll, setDemoMode } from '../services/storage.service'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { Role, StaffUser } from '../types/user.types'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

export const TEST_LOGIN = 'direktor'
export const TEST_PASSWORD = 'maxfiyParol1'
export const TEST_USER_ID = 'u-test'
export const TEST_SESSION_ID = 's-test'

export interface SeedUser {
  id?: string
  login?: string
  password?: string
  fullName?: string
  title?: string
  role?: Role
  status?: StaffUser['status']
  mustChange?: boolean
}

// Xesh bir marta hisoblanadi (PBKDF2 sekin) — bir xil parolli foydalanuvchilar uchun keshlanadi
const hashCache = new Map<string, Promise<string>>()
function cachedHash(password: string): Promise<string> {
  let hash = hashCache.get(password)
  if (!hash) {
    hash = hashPassword(password, 'test-salt')
    hashCache.set(password, hash)
  }
  return hash
}

export async function buildUser(seed: SeedUser = {}): Promise<StaffUser> {
  return {
    id: seed.id ?? TEST_USER_ID,
    login: seed.login ?? TEST_LOGIN,
    fullName: seed.fullName ?? 'Dilshod Karimov',
    title: seed.title ?? 'Direktor',
    role: seed.role ?? 'admin',
    status: seed.status ?? 'active',
    salt: 'test-salt',
    passwordHash: await cachedHash(seed.password ?? TEST_PASSWORD),
    algo: 'pbkdf2-sha256',
    iterations: PBKDF2_ITERATIONS,
    mustChange: seed.mustChange ?? false,
    createdAt: '2026-09-01T09:00:00.000Z',
  }
}

// Xodimlar ro'yxati (standart: bitta administrator, vaqtinchalik parolsiz)
export async function seedUsers(seeds: SeedUser[] = [{}]): Promise<StaffUser[]> {
  const users = await Promise.all(seeds.map(buildUser))
  localStorage.setItem('apex:users', JSON.stringify(users))
  return users
}

export async function seedCredentials(login = TEST_LOGIN, password = TEST_PASSWORD, seed: SeedUser = {}) {
  await seedUsers([{ ...seed, login, password }])
}

// 1–27-bosqichdagi yagona login formati (apex:auth) — migratsiya testlari uchun
export async function seedLegacyCredentials(login = TEST_LOGIN, password = TEST_PASSWORD, mustChange = false) {
  const salt = 'test-salt'
  const passwordHash = await hashPassword(password, salt)
  localStorage.setItem(
    'apex:auth',
    JSON.stringify({ login, salt, passwordHash, algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS, mustChange }),
  )
}

export function seedSession(userId = TEST_USER_ID, sessionId = TEST_SESSION_ID) {
  const now = new Date().toISOString()
  localStorage.setItem('apex:sessions', JSON.stringify([{ id: sessionId, userId, startedAt: now, lastSeenAt: now, device: 'Chrome · Windows' }]))
  sessionStorage.setItem('apex:session', JSON.stringify({ id: sessionId, userId, startedAt: now }))
  // Tanishtiruv testlarga xalaqit bermasin (alohida testda tekshiriladi)
  localStorage.setItem('apex:tour', JSON.stringify({ [userId]: true }))
}

export function seedData({
  customers = [],
  transactions = [],
  courses = createMockCourses(),
}: { customers?: Customer[]; transactions?: Transaction[]; courses?: Course[] } = {}) {
  saveAll({ ...createEmptyData(), customers, transactions, courses })
  setDemoMode(false)
}

// Kirgan foydalanuvchi va tayyor ma'lumot bilan. role — kirgan xodimning roli (standart: administrator)
export async function renderSignedIn(data?: Parameters<typeof seedData>[0], seed: SeedUser = {}) {
  await seedUsers([seed])
  seedSession(seed.id ?? TEST_USER_ID)
  seedData(data)
  return renderApp()
}

export function renderApp() {
  const user = userEvent.setup()
  const view = render(<App />)
  return { user, ...view }
}

export function makeCustomer(patch: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    name: 'Aziza Karimova',
    phone: '+998 90 123 45 67',
    course: COURSES[0],
    status: 'paid',
    source: 'instagram',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...patch,
  }
}

export function makeTransaction(patch: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    type: 'income',
    amount: 650_000,
    method: 'card',
    category: 'course_fee',
    note: 'IELTS 1-oy',
    customerId: 'c1',
    customerName: 'Aziza Karimova',
    status: 'paid',
    date: new Date().toISOString(),
    ...patch,
  }
}

// Intl NBSP qaytarishi mumkin — matnni oddiy bo'shliqlarga keltirib solishtirish uchun
export const plain = (value: string | null | undefined) => (value ?? '').replace(/\s/g, ' ')
