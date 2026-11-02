// DIQQAT: bu faqat frontend darajasidagi himoya. Ma'lumotlar brauzerda saqlanadi va
// texnik foydalanuvchi uni chetlab o'ta oladi. Haqiqiy xavfsizlik uchun backend kerak.
import { isRecord } from '../utils/guards'

const AUTH_KEY = 'apex:auth'
const SESSION_KEY = 'apex:session'

export const DEFAULT_LOGIN = 'admin'
export const DEFAULT_PASSWORD = 'admin123'
export const MIN_PASSWORD_LENGTH = 8

// 'sha256' — eski (1–8-bosqich) format, faqat migratsiya uchun o'qiladi
export type HashAlgo = 'pbkdf2-sha256' | 'sha256'

// OWASP (2023) tavsiyasi: PBKDF2-HMAC-SHA256 uchun kamida 210 000 iteratsiya
export const PBKDF2_ITERATIONS = 210_000
const CURRENT_ALGO: HashAlgo = 'pbkdf2-sha256'

export interface Credentials {
  login: string
  salt: string
  passwordHash: string
  algo: HashAlgo
  iterations: number
  // Standart parol hali almashtirilmagan
  mustChange: boolean
}

export interface Session {
  login: string
  startedAt: string
}

export function isCryptoAvailable(): boolean {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined
  return typeof subtle?.digest === 'function' && typeof subtle.importKey === 'function' && typeof subtle.deriveBits === 'function'
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
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

async function hashFor(credentials: Credentials, password: string): Promise<string> {
  return credentials.algo === 'sha256'
    ? hashPasswordLegacy(password, credentials.salt)
    : hashPassword(password, credentials.salt, credentials.iterations)
}

async function checkPassword(credentials: Credentials, password: string): Promise<boolean> {
  return timingSafeEqual(await hashFor(credentials, password), credentials.passwordHash)
}

// Eski algoritm yoki kam iteratsiya — keyingi to'g'ri kirishda yangilanadi
export function needsRehash(credentials: Credentials): boolean {
  return credentials.algo !== CURRENT_ALGO || credentials.iterations < PBKDF2_ITERATIONS
}

async function createHash(password: string): Promise<Pick<Credentials, 'salt' | 'passwordHash' | 'algo' | 'iterations'>> {
  const salt = randomSalt()
  return { salt, passwordHash: await hashPassword(password, salt), algo: CURRENT_ALGO, iterations: PBKDF2_ITERATIONS }
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

function readCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isCredentials(parsed) ? normalizeCredentials(parsed) : null
  } catch {
    return null
  }
}

function writeCredentials(credentials: Credentials): void {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(credentials))
  } catch {
    // Saqlab bo'lmasa sessiya davomida xotiradagi qiymat ishlatiladi
  }
}

let pending: Promise<Credentials> | null = null

// Saqlangan ma'lumot bo'lmasa yoki buzilgan bo'lsa standart admin / admin123 yaratiladi
export function getCredentials(): Promise<Credentials> {
  const stored = readCredentials()
  if (stored) return Promise.resolve(stored)
  pending ??= (async () => {
    const credentials: Credentials = { login: DEFAULT_LOGIN, ...(await createHash(DEFAULT_PASSWORD)), mustChange: true }
    writeCredentials(credentials)
    pending = null
    return credentials
  })()
  return pending
}

export async function verifyLogin(login: string, password: string): Promise<boolean> {
  const credentials = await getCredentials()
  // Parol login to'g'ri-noto'g'riligidan qat'i nazar tekshiriladi — javob vaqti farq qilmasligi uchun
  const passwordOk = await checkPassword(credentials, password)
  const ok = login.trim().toLowerCase() === credentials.login.toLowerCase() && passwordOk
  // Migratsiya: eski SHA-256 yozuv to'g'ri parol bilan kirilganda PBKDF2 ga yangilanadi
  if (ok && needsRehash(credentials)) writeCredentials({ ...credentials, ...(await createHash(password)) })
  return ok
}

export type ChangeResult = { ok: true; credentials: Credentials } | { ok: false; field: 'current' | 'login' | 'password'; error: string }

export function validateLogin(login: string): string | null {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(login)) return 'Login 3–32 belgi: lotin harflari, raqam, _ . -'
  return null
}

export async function changeCredentials(currentPassword: string, newLogin: string, newPassword: string): Promise<ChangeResult> {
  const credentials = await getCredentials()
  if (!(await checkPassword(credentials, currentPassword))) {
    return { ok: false, field: 'current', error: 'Joriy parol noto\'g\'ri' }
  }
  const loginError = validateLogin(newLogin)
  if (loginError) return { ok: false, field: 'login', error: loginError }
  if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, field: 'password', error: `Yangi parol kamida ${MIN_PASSWORD_LENGTH} ta belgidan iborat bo'lishi kerak` }
  }
  if (newPassword && newPassword === DEFAULT_PASSWORD) {
    return { ok: false, field: 'password', error: 'Standart paroldan foydalanib bo\'lmaydi' }
  }
  // Parol o'zgarmasa ham eski formatdagi xesh joriy parol bilan yangilanadi
  const hash = newPassword ? await createHash(newPassword) : needsRehash(credentials) ? await createHash(currentPassword) : credentials
  const next: Credentials = {
    login: newLogin,
    salt: hash.salt,
    passwordHash: hash.passwordHash,
    algo: hash.algo,
    iterations: hash.iterations,
    mustChange: newPassword ? false : credentials.mustChange,
  }
  writeCredentials(next)
  return { ok: true, credentials: next }
}

// ===== Sessiya (sessionStorage: tab yopilganda tugaydi) =====

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isRecord(parsed) && typeof parsed.login === 'string' && typeof parsed.startedAt === 'string'
      ? { login: parsed.login, startedAt: parsed.startedAt }
      : null
  } catch {
    return null
  }
}

export function startSession(login: string): Session {
  const session = { login, startedAt: new Date().toISOString() }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Sessiyani saqlab bo'lmasa, sahifa yangilanguncha ishlaydi
  }
  return session
}

export function endSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // e'tiborsiz
  }
}
