// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BASE_LOCK_MS,
  formatLockWait,
  lockDuration,
  lockRemaining,
  LOGIN_LOCK_KEY,
  MAX_ATTEMPTS,
  MAX_LOCK_MS,
  readLockState,
  registerFailure,
  registerSuccess,
} from './loginLock.service'

const NOW = 1_800_000_000_000

function failTimes(count: number, now = NOW) {
  let state = readLockState()
  for (let i = 0; i < count; i++) state = registerFailure(now)
  return state
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
    expect(before).toMatchObject({ failures: MAX_ATTEMPTS - 1, lockCount: 0 })
    expect(lockRemaining(before, NOW)).toBe(0)
    const locked = registerFailure(NOW)
    expect(locked).toEqual({ failures: 0, lockCount: 1, lockedUntil: NOW + BASE_LOCK_MS })
    expect(lockRemaining(locked, NOW + 10_000)).toBe(20_000)
  })

  it('holat localStorage\'da saqlanadi (sahifa yangilansa tiklanmaydi)', () => {
    failTimes(MAX_ATTEMPTS)
    expect(localStorage.getItem(LOGIN_LOCK_KEY)).not.toBeNull()
    expect(readLockState()).toMatchObject({ lockCount: 1, lockedUntil: NOW + BASE_LOCK_MS })
  })

  it('ketma-ket bloklarda muddat oshib boradi: 30s -> 60s -> 120s', () => {
    expect(failTimes(MAX_ATTEMPTS).lockedUntil - NOW).toBe(30_000)
    expect(failTimes(MAX_ATTEMPTS).lockedUntil - NOW).toBe(60_000)
    expect(failTimes(MAX_ATTEMPTS).lockedUntil - NOW).toBe(120_000)
  })

  it('muvaffaqiyatli kirish hisoblagich va blok tarixini tozalaydi', () => {
    failTimes(MAX_ATTEMPTS + 2)
    registerSuccess()
    expect(readLockState()).toEqual({ failures: 0, lockCount: 0, lockedUntil: 0 })
    expect(failTimes(MAX_ATTEMPTS).lockedUntil - NOW).toBe(30_000)
  })

  it('buzuq saqlangan qiymat bo\'sh holat sifatida o\'qiladi', () => {
    localStorage.setItem(LOGIN_LOCK_KEY, JSON.stringify({ failures: -1, lockCount: 'x' }))
    expect(readLockState()).toEqual({ failures: 0, lockCount: 0, lockedUntil: 0 })
    localStorage.setItem(LOGIN_LOCK_KEY, '{buzuq')
    expect(readLockState().failures).toBe(0)
  })

  it('kutish vaqtini o\'qiladigan ko\'rinishda chiqaradi', () => {
    expect(formatLockWait(29_100)).toBe('30 soniya')
    expect(formatLockWait(60_000)).toBe('1 daqiqa')
    expect(formatLockWait(125_000)).toBe('2 daqiqa 5 soniya')
  })
})
