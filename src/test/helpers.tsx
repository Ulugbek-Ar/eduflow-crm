// Komponent testlari uchun umumiy yordamchilar: ma'lumotni oldindan yozish va ilovani chizish
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach } from 'vitest'
import App from '../App'
import { DEFAULT_SETTINGS } from '../constants/mockData'
import { hashPassword, PBKDF2_ITERATIONS } from '../services/auth.service'
import { saveAll, setDemoMode } from '../services/storage.service'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

export const TEST_LOGIN = 'direktor'
export const TEST_PASSWORD = 'maxfiyParol1'

// Standart parol emas (mustChange: false) — "parolni almashtiring" oynasi testlarga xalaqit bermaydi
export async function seedCredentials(login = TEST_LOGIN, password = TEST_PASSWORD) {
  const salt = 'test-salt'
  const passwordHash = await hashPassword(password, salt)
  localStorage.setItem(
    'apex:auth',
    JSON.stringify({ login, salt, passwordHash, algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS, mustChange: false }),
  )
}

export function seedSession(login = TEST_LOGIN) {
  sessionStorage.setItem('apex:session', JSON.stringify({ login, startedAt: new Date().toISOString() }))
}

export function seedData({ customers = [], transactions = [] }: { customers?: Customer[]; transactions?: Transaction[] } = {}) {
  saveAll({ customers, transactions, settings: { ...DEFAULT_SETTINGS, courses: [...DEFAULT_SETTINGS.courses] } })
  setDemoMode(false)
}

// Kirgan foydalanuvchi va tayyor ma'lumot bilan
export async function renderSignedIn(data?: Parameters<typeof seedData>[0]) {
  await seedCredentials()
  seedSession()
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
    course: DEFAULT_SETTINGS.courses[0],
    status: 'active',
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
    method: 'payme',
    category: 'course_fee',
    note: 'IELTS 1-oy',
    customerId: 'c1',
    customerName: 'Aziza Karimova',
    date: new Date().toISOString(),
    ...patch,
  }
}

// Intl NBSP qaytarishi mumkin — matnni oddiy bo'shliqlarga keltirib solishtirish uchun
export const plain = (value: string | null | undefined) => (value ?? '').replace(/\s/g, ' ')
