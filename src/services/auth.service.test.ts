// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkPassword,
  createHash,
  generateTempPassword,
  hashPassword,
  hashPasswordLegacy,
  isCredentials,
  needsRehash,
  PBKDF2_ITERATIONS,
  readLegacyCredentials,
  timingSafeEqual,
  validatePassword,
} from './auth.service'

const AUTH_KEY = 'apex:auth'

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

describe('parol tekshiruvi', () => {
  it('qisqa, mashhur va login bilan bir xil parollar rad etiladi', () => {
    expect(validatePassword('qisqa1')).toMatch(/kamida 8/)
    expect(validatePassword('admin123')).toMatch(/taxmin/)
    expect(validatePassword('12345678')).toMatch(/taxmin/)
    expect(validatePassword('aaaaaaaa')).toMatch(/bir xil belgi/)
    expect(validatePassword('direktor', 'Direktor')).toMatch(/login/)
    expect(validatePassword('x'.repeat(129))).toMatch(/128/)
    expect(validatePassword('Toshkent2026!')).toBeNull()
  })

  it('vaqtinchalik parol: 10 belgi, chalkash belgilarsiz, har safar boshqa', () => {
    const passwords = Array.from({ length: 50 }, () => generateTempPassword())
    for (const password of passwords) {
      expect(password).toHaveLength(10)
      expect(password).not.toMatch(/[0O1lI]/)
      expect(validatePassword(password)).toBeNull()
    }
    expect(new Set(passwords).size).toBe(passwords.length)
  })
})

describe('eski yagona login', () => {
  it('apex:auth o\'qiladi; eski SHA-256 formati algo bilan to\'ldiriladi', async () => {
    const passwordHash = await seedLegacy('direktor', 'eskiParol1')
    expect(readLegacyCredentials()).toMatchObject({ login: 'direktor', passwordHash, algo: 'sha256', iterations: 1 })
    expect(await checkPassword(readLegacyCredentials()!, 'eskiParol1')).toBe(true)
    expect(await checkPassword(readLegacyCredentials()!, 'xato')).toBe(false)
  })

  it('buzuq yozuv null', () => {
    localStorage.setItem(AUTH_KEY, '{"login":1}')
    expect(readLegacyCredentials()).toBeNull()
  })

  it('PBKDF2 xesh: yangi tuz, kerakli iteratsiya; eski formatga qayta xeshlash kerak', async () => {
    const hash = await createHash('yangiParol1')
    expect(hash).toMatchObject({ algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS })
    expect(hash.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(needsRehash(hash)).toBe(false)
    expect(needsRehash({ ...hash, algo: 'sha256', iterations: 1 })).toBe(true)
    expect(needsRehash({ ...hash, iterations: 1000 })).toBe(true)
  })
})
