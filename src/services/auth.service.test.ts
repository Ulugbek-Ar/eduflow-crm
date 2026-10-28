// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { changeCredentials, getCredentials, hashPassword, verifyLogin } from './auth.service'

beforeEach(() => {
  localStorage.clear()
})

describe('auth.service', () => {
  it('SHA-256 (tuz bilan) mos qiymat beradi', async () => {
    expect(await hashPassword('admin123', '00ff')).toBe('6ae392b1d220e61790909295f1402e012f006c317906f12a6266b7821862cc1c')
  })

  it('standart admin / admin123 yaratiladi, parol ochiq saqlanmaydi', async () => {
    const credentials = await getCredentials()
    expect(credentials).toMatchObject({ login: 'admin', mustChange: true })
    expect(localStorage.getItem('apex:auth')).not.toContain('admin123')
    expect(await verifyLogin('ADMIN', 'admin123')).toBe(true)
    expect(await verifyLogin('admin', 'xato')).toBe(false)
  })

  it('parolni almashtirish: tekshiruvlar va muvaffaqiyat', async () => {
    expect(await changeCredentials('xato', 'admin', 'yangiParol1')).toMatchObject({ ok: false, field: 'current' })
    expect(await changeCredentials('admin123', 'admin', 'qisqa')).toMatchObject({ ok: false, field: 'password' })
    expect(await changeCredentials('admin123', 'a b', 'yangiParol1')).toMatchObject({ ok: false, field: 'login' })
    const result = await changeCredentials('admin123', 'direktor', 'yangiParol1')
    expect(result).toMatchObject({ ok: true, credentials: { login: 'direktor', mustChange: false } })
    expect(await verifyLogin('direktor', 'yangiParol1')).toBe(true)
    expect(await verifyLogin('admin', 'admin123')).toBe(false)
  })
})
