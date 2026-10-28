// DIQQAT: bu faqat frontend darajasidagi himoya. Ma'lumotlar brauzerda saqlanadi va
// texnik foydalanuvchi uni chetlab o'ta oladi. Haqiqiy xavfsizlik uchun backend kerak.
import { isRecord } from '../utils/guards'

const AUTH_KEY = 'apex:auth'
const SESSION_KEY = 'apex:session'

export const DEFAULT_LOGIN = 'admin'
export const DEFAULT_PASSWORD = 'admin123'
export const MIN_PASSWORD_LENGTH = 8

export interface Credentials {
  login: string
  salt: string
  passwordHash: string
  // Standart parol hali almashtirilmagan
  mustChange: boolean
}

export interface Session {
  login: string
  startedAt: string
}

export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle?.digest === 'function'
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
}

// SHA-256 (Web Crypto) — tuz (salt) bilan, bir xil parollar bir xil hash bermasligi uchun
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  return toHex(await crypto.subtle.digest('SHA-256', data))
}

function isCredentials(value: unknown): value is Credentials {
  return (
    isRecord(value) &&
    typeof value.login === 'string' &&
    value.login.length > 0 &&
    typeof value.salt === 'string' &&
    typeof value.passwordHash === 'string' &&
    /^[0-9a-f]{64}$/.test(value.passwordHash) &&
    typeof value.mustChange === 'boolean'
  )
}

function readCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isCredentials(parsed) ? parsed : null
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
    const salt = randomSalt()
    const credentials: Credentials = {
      login: DEFAULT_LOGIN,
      salt,
      passwordHash: await hashPassword(DEFAULT_PASSWORD, salt),
      mustChange: true,
    }
    writeCredentials(credentials)
    pending = null
    return credentials
  })()
  return pending
}

export async function verifyLogin(login: string, password: string): Promise<boolean> {
  const credentials = await getCredentials()
  const hash = await hashPassword(password, credentials.salt)
  return login.trim().toLowerCase() === credentials.login.toLowerCase() && hash === credentials.passwordHash
}

export type ChangeResult = { ok: true; credentials: Credentials } | { ok: false; field: 'current' | 'login' | 'password'; error: string }

export function validateLogin(login: string): string | null {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(login)) return 'Login 3–32 belgi: lotin harflari, raqam, _ . -'
  return null
}

export async function changeCredentials(currentPassword: string, newLogin: string, newPassword: string): Promise<ChangeResult> {
  const credentials = await getCredentials()
  if ((await hashPassword(currentPassword, credentials.salt)) !== credentials.passwordHash) {
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
  const salt = newPassword ? randomSalt() : credentials.salt
  const next: Credentials = {
    login: newLogin,
    salt,
    passwordHash: newPassword ? await hashPassword(newPassword, salt) : credentials.passwordHash,
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
