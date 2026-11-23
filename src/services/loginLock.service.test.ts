// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BASE_LOCK_MS,
  formatLockWait,
  isLockStateStale,
  LOCK_RESET_MS,
  lockDuration,
  lockRemaining,
  LOGIN_LOCK_KEY,
  MAX_ATTEMPTS,
  MAX_LOCK_MS,
  readLockState,
  registerFailure,
  registerSuccess,
} from './loginLock.service'

// Testlar real soatga bog'liq bo'lmasligi uchun vaqt hamma joyda aniq uzatiladi
const NOW = 1_800_000_000_000
const EMPTY = { failures: 0, lockCount: 0, lockedUntil: 0, lastFailureAt: 0 }

function failTimes(count: number, now = NOW) {
  let state = readLockState(now)
  for (let i = 0; i < count; i++) state = registerFailure(now)
  return state
}

function seed(state: Record<string, unknown>) {
  localStorage.setItem(LOGIN_LOCK_KEY, JSON.stringify(state))
}

beforeEach(() => {
  localStorage.clear()
})

describe('loginLock.service', () => {
  it('muddat har blokda ikki baravar oshadi, 15 daqiqadan oshmaydi', () => {
    expect(lockDuration(0)).toBe(0)
    expect(lockDuration(1)).toBe(30_000)
    expect(lockDuration(2)).toBe(60_000)
    expect(lockDuration(3)).toBe(120_000)
    expect(lockDuration(6)).toBe(MAX_LOCK_MS)
    expect(lockDuration(50)).toBe(MAX_LOCK_MS)
  })

  it(`${MAX_ATTEMPTS} ta noto'g'ri urinishdan keyin blok boshlanadi`, () => {
    const before = failTimes(MAX_ATTEMPTS - 1)
    expect(before).toEqual({ failures: MAX_ATTEMPTS - 1, lockCount: 0, lockedUntil: 0, lastFailureAt: NOW })
    expect(lockRemaining(before, NOW)).toBe(0)
    const locked = registerFailure(NOW)
    expect(locked).toEqual({ failures: 0, lockCount: 1, lockedUntil: NOW + BASE_LOCK_MS, lastFailureAt: NOW })
    expect(lockRemaining(locked, NOW + 10_000)).toBe(20_000)
  })

  it('holat localStorage\'da saqlanadi (sahifa yangilansa tiklanmaydi)', () => {
    failTimes(MAX_ATTEMPTS)
    expect(JSON.parse(localStorage.getItem(LOGIN_LOCK_KEY) ?? '{}')).toEqual({
      failures: 0,
      lockCount: 1,
      lockedUntil: NOW + BASE_LOCK_MS,
      lastFailureAt: NOW,
    })
    expect(readLockState(NOW)).toMatchObject({ lockCount: 1, lockedUntil: NOW + BASE_LOCK_MS })
  })

  it('ketma-ket bloklarda muddat oshib boradi: 30s -> 60s -> 120s', () => {
    expect(failTimes(MAX_ATTEMPTS).lockedUntil - NOW).toBe(30_000)
    expect(failTimes(MAX_ATTEMPTS).lockedUntil - NOW).toBe(60_000)
    expect(failTimes(MAX_ATTEMPTS).lockedUntil - NOW).toBe(120_000)
  })

  it('muvaffaqiyatli kirish hisoblagich va blok tarixini tozalaydi', () => {
    failTimes(MAX_ATTEMPTS + 2)
    registerSuccess()
    expect(readLockState(NOW)).toEqual(EMPTY)
    expect(failTimes(MAX_ATTEMPTS).lockedUntil - NOW).toBe(30_000)
  })

  it('buzuq saqlangan qiymat bo\'sh holat sifatida o\'qiladi', () => {
    seed({ failures: -1, lockCount: 'x' })
    expect(readLockState(NOW)).toEqual(EMPTY)
    seed({ failures: 1, lockCount: 0, lockedUntil: 0, lastFailureAt: 'kecha' })
    expect(readLockState(NOW)).toEqual(EMPTY)
    localStorage.setItem(LOGIN_LOCK_KEY, '{buzuq')
    expect(readLockState(NOW)).toEqual(EMPTY)
  })

  it('kutish vaqtini o\'qiladigan ko\'rinishda chiqaradi', () => {
    expect(formatLockWait(29_100)).toBe('30 soniya')
    expect(formatLockWait(60_000)).toBe('1 daqiqa')
    expect(formatLockWait(125_000)).toBe('2 daqiqa 5 soniya')
  })
})

describe('24 soatdan keyin nolga tushish', () => {
  it('oxirgi blok tugaganidan 24 soat o\'tgach lockCount va failures nolga tushadi', () => {
    failTimes(MAX_ATTEMPTS * 3)
    const lockEnd = NOW + lockDuration(3)
    // Blokdan keyin yana 2 ta xato — ular ham 24 soat chegarasida nolga tushadi
    registerFailure(lockEnd + 60_000)
    registerFailure(lockEnd + 60_000)
    expect(LOCK_RESET_MS).toBe(24 * 60 * 60 * 1000)
    expect(readLockState(lockEnd + LOCK_RESET_MS - 1)).toMatchObject({ failures: 2, lockCount: 3 })
    expect(readLockState(lockEnd + LOCK_RESET_MS)).toEqual(EMPTY)
  })

  it('nolga tushgach keyingi blok yana 30 soniyadan boshlanadi', () => {
    failTimes(MAX_ATTEMPTS * 4)
    const later = NOW + lockDuration(4) + LOCK_RESET_MS
    const first = registerFailure(later)
    expect(first).toEqual({ failures: 1, lockCount: 0, lockedUntil: 0, lastFailureAt: later })
    expect(failTimes(MAX_ATTEMPTS - 1, later).lockedUntil - later).toBe(BASE_LOCK_MS)
  })

  it('24 soat ichida yana bloklansa, muddat oshishda davom etadi', () => {
    failTimes(MAX_ATTEMPTS)
    const nextDay = NOW + BASE_LOCK_MS + LOCK_RESET_MS - 60_000
    expect(failTimes(MAX_ATTEMPTS, nextDay)).toMatchObject({ lockCount: 2, lockedUntil: nextDay + 60_000 })
  })

  it('blok paytida holat eskirmaydi', () => {
    seed({ failures: 0, lockCount: 6, lockedUntil: NOW + MAX_LOCK_MS, lastFailureAt: NOW })
    expect(lockRemaining(readLockState(NOW), NOW)).toBe(MAX_LOCK_MS)
    expect(isLockStateStale(readLockState(NOW), NOW + MAX_LOCK_MS + LOCK_RESET_MS - 1)).toBe(false)
  })

  it('blok bo\'lmagan bo\'lsa, oxirgi noto\'g\'ri urinishdan 24 soat o\'tgach failures nolga tushadi', () => {
    failTimes(MAX_ATTEMPTS - 2)
    const last = registerFailure(NOW + 60_000)
    expect(last.failures).toBe(MAX_ATTEMPTS - 1)
    expect(readLockState(NOW + 60_000 + LOCK_RESET_MS - 1).failures).toBe(MAX_ATTEMPTS - 1)
    expect(readLockState(NOW + 60_000 + LOCK_RESET_MS)).toEqual(EMPTY)
    // Eski urinishlar hisobga olinmaydi: bitta yangi xato blokka olib kelmaydi
    expect(registerFailure(NOW + 60_000 + LOCK_RESET_MS)).toMatchObject({ failures: 1, lockCount: 0 })
  })
})

describe('eski format (lastFailureAt maydonisiz)', () => {
  it('faol blok saqlanib qoladi', () => {
    seed({ failures: 0, lockCount: 2, lockedUntil: NOW + 45_000 })
    const state = readLockState(NOW)
    expect(state).toEqual({ failures: 0, lockCount: 2, lockedUntil: NOW + 45_000, lastFailureAt: 0 })
    expect(lockRemaining(state, NOW)).toBe(45_000)
  })

  it('oxirgi blok tugaganidan 24 soat o\'tgan bo\'lsa nolga tushadi', () => {
    seed({ failures: 3, lockCount: 4, lockedUntil: NOW })
    expect(readLockState(NOW + LOCK_RESET_MS - 1)).toMatchObject({ failures: 3, lockCount: 4 })
    expect(readLockState(NOW + LOCK_RESET_MS)).toEqual(EMPTY)
  })

  it('blokgacha yetmagan urinishlar yo\'qolmaydi va keyingi xato bilan birga sanaladi', () => {
    seed({ failures: MAX_ATTEMPTS - 1, lockCount: 0, lockedUntil: 0 })
    // Urinish vaqti noma'lum — xavfsiz tomonga "hozirgina" deb hisoblanadi
    expect(readLockState(NOW)).toEqual({ failures: MAX_ATTEMPTS - 1, lockCount: 0, lockedUntil: 0, lastFailureAt: NOW })
    expect(registerFailure(NOW)).toEqual({ failures: 0, lockCount: 1, lockedUntil: NOW + BASE_LOCK_MS, lastFailureAt: NOW })
  })

  it('keyingi yozuvda yangi formatga o\'tadi', () => {
    seed({ failures: 1, lockCount: 0, lockedUntil: 0 })
    registerFailure(NOW)
    expect(JSON.parse(localStorage.getItem(LOGIN_LOCK_KEY) ?? '{}')).toEqual({ failures: 2, lockCount: 0, lockedUntil: 0, lastFailureAt: NOW })
  })
})
