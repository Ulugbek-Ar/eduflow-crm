// Kirish urinishlarini cheklash. Holat localStorage'da saqlanadi — sahifa yangilansa ham blok saqlanib qoladi.
// DIQQAT: bu ham faqat frontend himoyasi; brauzer ma'lumotini tozalab chetlab o'tish mumkin.
import { isRecord } from '../utils/guards'
import { readJson, setItem } from './storage.service'

export const LOGIN_LOCK_KEY = 'apex:login-lock'
export const MAX_ATTEMPTS = 5
export const BASE_LOCK_MS = 30_000
export const MAX_LOCK_MS = 15 * 60_000

export interface LoginLockState {
  // Joriy blokdan keyingi ketma-ket noto'g'ri urinishlar
  failures: number
  // Muvaffaqiyatli kirishsiz ketma-ket bloklar soni (muddat shunga qarab oshadi)
  lockCount: number
  // Blok tugaydigan vaqt (ms, Date.now()); 0 — blok yo'q
  lockedUntil: number
}

const EMPTY: LoginLockState = { failures: 0, lockCount: 0, lockedUntil: 0 }

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function readLockState(): LoginLockState {
  const raw = readJson(LOGIN_LOCK_KEY)
  if (!isRecord(raw) || !isCount(raw.failures) || !isCount(raw.lockCount) || !isCount(raw.lockedUntil)) return { ...EMPTY }
  return { failures: raw.failures, lockCount: raw.lockCount, lockedUntil: raw.lockedUntil }
}

// 1-blok: 30s, 2-blok: 60s, 3-blok: 120s ... maksimum 15 daqiqa
export function lockDuration(lockCount: number): number {
  if (lockCount <= 0) return 0
  return Math.min(BASE_LOCK_MS * 2 ** (lockCount - 1), MAX_LOCK_MS)
}

// Blok tugashiga qolgan vaqt (ms); blok bo'lmasa 0
export function lockRemaining(state: LoginLockState, now = Date.now()): number {
  return Math.max(0, state.lockedUntil - now)
}

// Noto'g'ri urinishni qayd etadi; MAX_ATTEMPTS ga yetsa navbatdagi (uzunroq) blok boshlanadi
export function registerFailure(now = Date.now()): LoginLockState {
  const current = readLockState()
  const failures = current.failures + 1
  const next: LoginLockState =
    failures >= MAX_ATTEMPTS
      ? { failures: 0, lockCount: current.lockCount + 1, lockedUntil: now + lockDuration(current.lockCount + 1) }
      : { ...current, failures }
  setItem(LOGIN_LOCK_KEY, next)
  return next
}

// Muvaffaqiyatli kirish — hisoblagich va blok tarixi tozalanadi
export function registerSuccess(): void {
  setItem(LOGIN_LOCK_KEY, EMPTY)
}

// 45 000 -> "45 soniya", 125 000 -> "2 daqiqa 5 soniya"
export function formatLockWait(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes === 0) return `${seconds} soniya`
  return seconds === 0 ? `${minutes} daqiqa` : `${minutes} daqiqa ${seconds} soniya`
}
