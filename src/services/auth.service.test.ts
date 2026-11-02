// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  changeCredentials,
  getCredentials,
  hashPassword,
  hashPasswordLegacy,
  isCredentials,
  PBKDF2_ITERATIONS,
  timingSafeEqual,
  verifyLogin,
} from './auth.service'

const AUTH_KEY = 'apex:auth'

function storedAuth(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') as Record<string, unknown>
}

// 1–8-bosqichdagi format: algo/iterations maydonlarisiz, SHA-256
async function seedLegacy(login: string, password: string, salt = '00ff') {
  const passwordHash = await hashPasswordLegacy(password, salt)
  localStorage.setItem(AUTH_KEY, JSON.stringify({ login, salt, passwordHash, mustChange: false }))
  return passwordHash
}

beforeEach(() => {
  localStorage.clear()
})

describe('xeshlash', () => {
  it('eski SHA-256 (tuz bilan) mos qiymat beradi', async () => {
    expect(await hashPasswordLegacy('admin123', '00ff')).toBe('6ae392b1d220e61790909295f1402e012f006c317906f12a6266b7821862cc1c')
  })

  it('PBKDF2-SHA256: RFC 7914 / Web Crypto bilan mos test vektori', async () => {
    // PBKDF2-HMAC-SHA256("password", "salt", 1, 32)
    expect(await hashPassword('password', 'salt', 1)).toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b')
  })

  it('iteratsiya soni kamida 210 000', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(210_000)
  })

  it('timingSafeEqual', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
    expect(timingSafeEqual('', '')).toBe(true)
  })
})

describe('isCredentials', () => {
  const base = { login: 'admin', salt: 'aa', passwordHash: 'a'.repeat(64), mustChange: false }

  it('eski va yangi formatni qabul qiladi', () => {
    expect(isCredentials(base)).toBe(true)
    expect(isCredentials({ ...base, algo: 'sha256' })).toBe(true)
    expect(isCredentials({ ...base, algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS })).toBe(true)
  })

  it('noto\'g\'ri algoritm yoki iteratsiyani rad etadi', () => {
    expect(isCredentials({ ...base, algo: 'md5' })).toBe(false)
    expect(isCredentials({ ...base, algo: 'pbkdf2-sha256' })).toBe(false)
    expect(isCredentials({ ...base, algo: 'pbkdf2-sha256', iterations: 0 })).toBe(false)
    expect(isCredentials({ ...base, iterations: 5 })).toBe(false)
    expect(isCredentials({ ...base, passwordHash: 'xyz' })).toBe(false)
  })
})

describe('auth.service', () => {
  it('standart admin / admin123 PBKDF2 bilan yaratiladi, parol ochiq saqlanmaydi', async () => {
    const credentials = await getCredentials()
    expect(credentials).toMatchObject({ login: 'admin', mustChange: true, algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS })
    expect(localStorage.getItem(AUTH_KEY)).not.toContain('admin123')
    expect(await verifyLogin('ADMIN', 'admin123')).toBe(true)
    expect(await verifyLogin('admin', 'xato')).toBe(false)
    expect(await verifyLogin('boshqa', 'admin123')).toBe(false)
  })

  it('parolni almashtirish: tekshiruvlar va muvaffaqiyat', async () => {
    expect(await changeCredentials('xato', 'admin', 'yangiParol1')).toMatchObject({ ok: false, field: 'current' })
    expect(await changeCredentials('admin123', 'admin', 'qisqa')).toMatchObject({ ok: false, field: 'password' })
    expect(await changeCredentials('admin123', 'a b', 'yangiParol1')).toMatchObject({ ok: false, field: 'login' })
    const result = await changeCredentials('admin123', 'direktor', 'yangiParol1')
    expect(result).toMatchObject({ ok: true, credentials: { login: 'direktor', mustChange: false, algo: 'pbkdf2-sha256' } })
    expect(await verifyLogin('direktor', 'yangiParol1')).toBe(true)
    expect(await verifyLogin('admin', 'admin123')).toBe(false)
  })
})

describe('SHA-256 -> PBKDF2 migratsiyasi', () => {
  it('to\'g\'ri parol bilan kirilganda xesh PBKDF2 ga yangilanadi', async () => {
    const legacyHash = await seedLegacy('direktor', 'eskiParol1')
    expect(await verifyLogin('direktor', 'eskiParol1')).toBe(true)
    const stored = storedAuth()
    expect(stored).toMatchObject({ login: 'direktor', algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS, mustChange: false })
    expect(stored.passwordHash).not.toBe(legacyHash)
    expect(stored.salt).not.toBe('00ff')
    // Yangilangan yozuv bilan ham kirish ishlaydi
    expect(await verifyLogin('direktor', 'eskiParol1')).toBe(true)
  })

  it('noto\'g\'ri parolda eski yozuv o\'zgarmaydi', async () => {
    const legacyHash = await seedLegacy('direktor', 'eskiParol1')
    expect(await verifyLogin('direktor', 'xato')).toBe(false)
    expect(storedAuth()).toEqual({ login: 'direktor', salt: '00ff', passwordHash: legacyHash, mustChange: false })
  })

  it('faqat login o\'zgartirilganda ham eski xesh yangilanadi', async () => {
    await seedLegacy('direktor', 'eskiParol1')
    const result = await changeCredentials('eskiParol1', 'rahbar', '')
    expect(result).toMatchObject({ ok: true, credentials: { login: 'rahbar', algo: 'pbkdf2-sha256' } })
    expect(await verifyLogin('rahbar', 'eskiParol1')).toBe(true)
  })
})
