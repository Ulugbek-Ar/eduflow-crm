// Parol xeshlash va eski (bitta login) formatni o'qish.
// DIQQAT: lokal rejimda bu faqat frontend darajasidagi himoya — ma'lumotlar brauzerda saqlanadi va
// texnik foydalanuvchi uni chetlab o'ta oladi. Haqiqiy xavfsizlik — Supabase rejimi (Auth + RLS)
import { isRecord } from '../utils/guards'
import { readJson } from './storage.service'

// 1–27-bosqichlardagi yagona administrator yozuvi. Endi faqat xodimlar ro'yxatiga ko'chirish uchun o'qiladi
export const LEGACY_AUTH_KEY = 'apex:auth'

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

// Hamma biladigan yoki taxmin qilish oson parollar — qabul qilinmaydi
const WEAK_PASSWORDS: ReadonlySet<string> = new Set([
  'admin123',
  'administrator',
  'password',
  'password1',
  'parol123',
  'qwerty123',
  'qwertyui',
  '12345678',
  '123456789',
  '1234567890',
  '11111111',
  '00000000',
  '87654321',
])

// 'sha256' — eski (1–8-bosqich) format, faqat migratsiya uchun o'qiladi
export type HashAlgo = 'pbkdf2-sha256' | 'sha256'

// OWASP (2023) tavsiyasi: PBKDF2-HMAC-SHA256 uchun kamida 210 000 iteratsiya
export const PBKDF2_ITERATIONS = 210_000
const CURRENT_ALGO: HashAlgo = 'pbkdf2-sha256'

export interface PasswordHash {
  salt: string
  passwordHash: string
  algo: HashAlgo
  iterations: number
}

export interface Credentials extends PasswordHash {
  login: string
  // Standart parol hali almashtirilmagan
  mustChange: boolean
}

export function isCryptoAvailable(): boolean {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined
  return typeof subtle?.digest === 'function' && typeof subtle.importKey === 'function' && typeof subtle.deriveBits === 'function'
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomHex(bytes = 16): string {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return toHex(data.buffer)
}

// Eski format: SHA-256(salt:parol). Faqat mavjud yozuvlarni tekshirish uchun qoldirilgan
export async function hashPasswordLegacy(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  return toHex(await crypto.subtle.digest('SHA-256', data))
}

// PBKDF2-HMAC-SHA256 (Web Crypto): sekin hisoblanadi — parolni tanlab topish qimmatlashadi
export async function hashPassword(password: string, salt: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256)
  return toHex(bits)
}

// O'zgarmas vaqtli solishtirish: birinchi farq qiluvchi belgida to'xtamaydi (timing hujumlariga qarshi)
export function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export async function checkPassword(record: PasswordHash, password: string): Promise<boolean> {
  const hash = record.algo === 'sha256' ? await hashPasswordLegacy(password, record.salt) : await hashPassword(password, record.salt, record.iterations)
  return timingSafeEqual(hash, record.passwordHash)
}

// Eski algoritm yoki kam iteratsiya — keyingi to'g'ri kirishda yangilanadi
export function needsRehash(record: PasswordHash): boolean {
  return record.algo !== CURRENT_ALGO || record.iterations < PBKDF2_ITERATIONS
}

export async function createHash(password: string): Promise<PasswordHash> {
  const salt = randomHex()
  return { salt, passwordHash: await hashPassword(password, salt), algo: CURRENT_ALGO, iterations: PBKDF2_ITERATIONS }
}

// Login topilmaganda ham xuddi shuncha vaqt sarflanadi — javob vaqtidan login borligini bilib bo'lmaydi
let dummy: Promise<PasswordHash> | null = null
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= createHash(randomHex())
  await checkPassword(await dummy, password)
}

export function isHashAlgo(value: unknown): value is HashAlgo {
  return value === 'pbkdf2-sha256' || value === 'sha256'
}

export function isPasswordHashFields(value: Record<string, unknown>): boolean {
  if (typeof value.salt !== 'string' || typeof value.passwordHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.passwordHash)) return false
  if (value.algo === 'sha256') return value.iterations === 1
  return value.algo === 'pbkdf2-sha256' && Number.isInteger(value.iterations) && (value.iterations as number) > 0
}

// Ikkala formatni qabul qiladi: yangi (algo + iterations) va eski (bu maydonlarsiz, SHA-256)
export function isCredentials(value: unknown): value is Credentials {
  if (
    !isRecord(value) ||
    typeof value.login !== 'string' ||
    value.login.length === 0 ||
    typeof value.salt !== 'string' ||
    typeof value.passwordHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.passwordHash) ||
    typeof value.mustChange !== 'boolean'
  ) {
    return false
  }
  if (value.algo === undefined) return value.iterations === undefined
  if (value.algo === 'sha256') return value.iterations === undefined || value.iterations === 1
  return value.algo === 'pbkdf2-sha256' && Number.isInteger(value.iterations) && (value.iterations as number) > 0
}

function normalizeCredentials(value: Credentials): Credentials {
  if (value.algo === undefined || value.algo === 'sha256') return { ...value, algo: 'sha256', iterations: 1 }
  return value
}

// Eski yagona login (bo'lmasa yoki buzilgan bo'lsa null)
export function readLegacyCredentials(): Credentials | null {
  const parsed = readJson(LEGACY_AUTH_KEY)
  return isCredentials(parsed) ? normalizeCredentials(parsed) : null
}

export function validateLogin(login: string): string | null {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(login)) return 'Login 3–32 belgi: lotin harflari, raqam, _ . -'
  return null
}

export function validatePassword(password: string, login = ''): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Parol kamida ${MIN_PASSWORD_LENGTH} ta belgidan iborat bo'lishi kerak`
  if (password.length > MAX_PASSWORD_LENGTH) return `Parol ${MAX_PASSWORD_LENGTH} belgidan oshmasin`
  const lower = password.toLowerCase()
  if (WEAK_PASSWORDS.has(lower)) return 'Bu parolni taxmin qilish juda oson — boshqasini tanlang'
  if (login && lower === login.trim().toLowerCase()) return 'Parol login bilan bir xil bo\'lmasin'
  if (/^(.)\1+$/.test(password)) return 'Parol bir xil belgilardan iborat bo\'lmasin'
  return null
}

// Vaqtinchalik parol: chalkash belgilar yo'q (0/O, 1/l/I) — og'zaki aytish va qo'lda yozish oson
const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateTempPassword(length = 10): string {
  const result: string[] = []
  const bytes = new Uint8Array(1)
  // Rad etish usuli: modul tufayli ba'zi belgilar tez-tez chiqib qolmasin
  const limit = 256 - (256 % TEMP_ALPHABET.length)
  while (result.length < length) {
    crypto.getRandomValues(bytes)
    if (bytes[0] < limit) result.push(TEMP_ALPHABET[bytes[0] % TEMP_ALPHABET.length])
  }
  const password = result.join('')
  // Juda kam ehtimol, lekin tekshiruvdan o'tmasa qaytadan
  return validatePassword(password) ? generateTempPassword(length) : password
}
