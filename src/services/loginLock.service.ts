// Kirish urinishlarini cheklash. Holat localStorage'da saqlanadi — sahifa yangilansa ham blok saqlanib qoladi.
// DIQQAT: bu ham faqat frontend himoyasi; brauzer ma'lumotini tozalab chetlab o'tish mumkin.
import { tr } from '../i18n'
import { isRecord } from '../utils/guards'
import { readJson, setItem } from './storage.service'

export const LOGIN_LOCK_KEY = 'apex:login-lock'
export const MAX_ATTEMPTS = 5
export const BASE_LOCK_MS = 30_000
export const MAX_LOCK_MS = 15 * 60_000
// Shuncha vaqt tinch o'tsa, hisoblagich va blok tarixi nolga tushadi (keyingi blok yana 30 soniyadan boshlanadi)
export const LOCK_RESET_MS = 24 * 60 * 60_000

export interface LoginLockState {
  // Joriy blokdan keyingi ketma-ket noto'g'ri urinishlar
  failures: number
  // Muvaffaqiyatli kirishsiz ketma-ket bloklar soni (muddat shunga qarab oshadi)
  lockCount: number
  // Oxirgi blok tugaydigan (tugagan) vaqt (ms, Date.now()); 0 — blok bo'lmagan.
  // Blok tugagach ham saqlanadi: 24 soatlik muddat shundan hisoblanadi
  lockedUntil: number
  // Oxirgi noto'g'ri urinish vaqti (ms); 0 — urinish yo'q.
  // Blok bo'lmaganda eskirgan urinishlarni tozalash uchun kerak (bunda lockedUntil = 0)
  lastFailureAt: number
}

const EMPTY: LoginLockState = { failures: 0, lockCount: 0, lockedUntil: 0, lastFailureAt: 0 }

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// Saqlangan qiymatni tekshiradi; buzuq bo'lsa null.
// Eski format (10–15-bosqich, lastFailureAt yo'q) ham qabul qilinadi: oxirgi urinish vaqti noma'lum bo'lgani uchun
// xavfsiz tomonga — urinishlar hozirgina bo'lgan deb hisoblanadi (yo'qolmaydi, keyingi urinish bilan birga sanaladi)
function parseLockState(raw: unknown, now: number): LoginLockState | null {
  if (!isRecord(raw)) return null
  const { failures, lockCount, lockedUntil, lastFailureAt } = raw
  if (!isCount(failures) || !isCount(lockCount) || !isCount(lockedUntil)) return null
  if (lastFailureAt === undefined) return { failures, lockCount, lockedUntil, lastFailureAt: failures > 0 ? now : 0 }
  return isCount(lastFailureAt) ? { failures, lockCount, lockedUntil, lastFailureAt } : null
}

// Eskirgan holat: blok bo'lgan bo'lsa — oxirgi blok tugaganidan 24 soat o'tgan;
// blok bo'lmagan bo'lsa — oxirgi noto'g'ri urinishdan 24 soat o'tgan
export function isLockStateStale(state: LoginLockState, now = Date.now()): boolean {
  if (state.lockCount > 0) return now - state.lockedUntil >= LOCK_RESET_MS
  return state.failures > 0 && now - state.lastFailureAt >= LOCK_RESET_MS
}

// Buzuq yoki eskirgan holat bo'sh holat sifatida qaytadi (localStorage keyingi yozuvda yangilanadi)
export function readLockState(now = Date.now()): LoginLockState {
  const state = parseLockState(readJson(LOGIN_LOCK_KEY), now)
  return state && !isLockStateStale(state, now) ? state : { ...EMPTY }
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
  const current = readLockState(now)
  const failures = current.failures + 1
  const next: LoginLockState =
    failures >= MAX_ATTEMPTS
      ? { failures: 0, lockCount: current.lockCount + 1, lockedUntil: now + lockDuration(current.lockCount + 1), lastFailureAt: now }
      : { ...current, failures, lastFailureAt: now }
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
  if (minutes === 0) return tr('{0} soniya', { 0: seconds })
  return seconds === 0 ? tr('{0} daqiqa', { 0: minutes }) : tr('{0} daqiqa {1} soniya', { 0: minutes, 1: seconds })
}
