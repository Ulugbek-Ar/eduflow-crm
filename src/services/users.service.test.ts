// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { buildUser, seedUsers } from '../test/helpers'
import { hashPasswordLegacy, PBKDF2_ITERATIONS } from './auth.service'
import {
  addUser,
  authenticate,
  changeOwnCredentials,
  completePasswordChange,
  createDemoStaff,
  createFirstAdmin,
  isStaffUser,
  loadUsers,
  resetPassword,
  toPublicUser,
  updateOwnProfile,
  updateUser,
  USERS_KEY,
} from './users.service'

function stored(): Array<Record<string, unknown>> {
  return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as Array<Record<string, unknown>>
}

beforeEach(() => {
  localStorage.clear()
})

describe('eski yagona logindan ko\'chirish', () => {
  it('apex:auth birinchi administrator bo\'ladi: ism va lavozim profil sozlamasidan', async () => {
    const passwordHash = await hashPasswordLegacy('eskiParol1', '00ff')
    localStorage.setItem('apex:auth', JSON.stringify({ login: 'direktor', salt: '00ff', passwordHash, mustChange: false }))
    localStorage.setItem('apex:settings', JSON.stringify({ profileName: 'Aziz Karimov', profileRole: 'Rahbar' }))
    const [admin] = loadUsers()
    expect(admin).toMatchObject({ login: 'direktor', fullName: 'Aziz Karimov', title: 'Rahbar', role: 'admin', status: 'active', algo: 'sha256', iterations: 1 })
    expect(stored()).toHaveLength(1)
    // Qayta o'qilganda yangi yozuv yaratilmaydi
    expect(loadUsers()[0].id).toBe(admin.id)
  })

  it('eski SHA-256 parol to\'g\'ri kiritilganda PBKDF2 ga yangilanadi, oxirgi kirish vaqti yoziladi', async () => {
    const passwordHash = await hashPasswordLegacy('eskiParol1', '00ff')
    localStorage.setItem('apex:auth', JSON.stringify({ login: 'direktor', salt: '00ff', passwordHash, mustChange: false }))
    const result = await authenticate('DIREKTOR', 'eskiParol1')
    expect(result.ok).toBe(true)
    expect(stored()[0]).toMatchObject({ algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS })
    expect(stored()[0].passwordHash).not.toBe(passwordHash)
    expect(typeof stored()[0].lastLoginAt).toBe('string')
    expect((await authenticate('direktor', 'eskiParol1')).ok).toBe(true)
  })

  it('standart parol (mustChange) saqlanadi — keyingi kirishda almashtirish majburiy', async () => {
    const passwordHash = await hashPasswordLegacy('admin123', '00ff')
    localStorage.setItem('apex:auth', JSON.stringify({ login: 'admin', salt: '00ff', passwordHash, mustChange: true }))
    const result = await authenticate('admin', 'admin123')
    expect(result.ok && result.user.mustChange).toBe(true)
  })

  it('eski login ham, ro\'yxat ham yo\'q — bo\'sh (ro\'yxatdan o\'tish ekrani)', () => {
    expect(loadUsers()).toEqual([])
  })
})

describe('kirish', () => {
  it('noto\'g\'ri parol va noma\'lum login bir xil javob beradi', async () => {
    await seedUsers()
    expect(await authenticate('direktor', 'xato-parol')).toEqual({ ok: false, reason: 'invalid' })
    expect(await authenticate('boshqa', 'maxfiyParol1')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('bloklangan xodim faqat to\'g\'ri parolda "bloklangan" javobini oladi', async () => {
    await seedUsers([{ status: 'blocked' }])
    expect(await authenticate('direktor', 'maxfiyParol1')).toEqual({ ok: false, reason: 'blocked' })
    expect(await authenticate('direktor', 'xato')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('buzuq yozuvlar tashlab yuboriladi', async () => {
    const good = await buildUser()
    localStorage.setItem(USERS_KEY, JSON.stringify([good, { ...good, id: 'x', role: 'superuser' }, { id: 'y' }]))
    expect(loadUsers()).toHaveLength(1)
    expect(isStaffUser({ ...good, passwordHash: 'abc' })).toBe(false)
  })

  it('PublicUser parol xeshini ko\'rsatmaydi', async () => {
    const user = toPublicUser(await buildUser())
    expect(Object.keys(user)).not.toContain('passwordHash')
    expect(Object.keys(user)).not.toContain('salt')
  })
})

describe('birinchi administrator', () => {
  it('yaratiladi; ikkinchi marta yaratib bo\'lmaydi', async () => {
    const result = await createFirstAdmin({ fullName: 'Dilshod Karimov', title: 'Direktor', login: 'dilshod', password: 'Toshkent2026' })
    expect(result.ok && result.user).toMatchObject({ role: 'admin', mustChange: false, login: 'dilshod' })
    expect(localStorage.getItem(USERS_KEY)).not.toContain('Toshkent2026')
    const again = await createFirstAdmin({ fullName: 'Boshqa', title: '', login: 'boshqa', password: 'Toshkent2026' })
    expect(again.ok).toBe(false)
  })

  it('xatolar tegishli maydonga qaytadi', async () => {
    expect(await createFirstAdmin({ fullName: 'D', title: '', login: 'dilshod', password: 'Toshkent2026' })).toMatchObject({ field: 'fullName' })
    expect(await createFirstAdmin({ fullName: 'Dilshod', title: '', login: 'd b', password: 'Toshkent2026' })).toMatchObject({ field: 'login' })
    expect(await createFirstAdmin({ fullName: 'Dilshod', title: '', login: 'dilshod', password: 'admin123' })).toMatchObject({ field: 'password' })
  })
})

describe('xodimlarni boshqarish', () => {
  it('xodim vaqtinchalik parol bilan qo\'shiladi, login band bo\'lsa rad etiladi', async () => {
    await seedUsers()
    const result = await addUser({ fullName: 'Malika Yusupova', title: 'Menejer', login: 'malika', role: 'manager', password: 'Vaqtincha22' })
    expect(result.ok && result.user).toMatchObject({ role: 'manager', mustChange: true, status: 'active' })
    expect(await addUser({ fullName: 'Malika 2', title: '', login: 'MALIKA', role: 'viewer', password: 'Vaqtincha22' })).toMatchObject({
      ok: false,
      field: 'login',
    })
  })

  it('oxirgi faol administratorni bloklab yoki rolini tushirib bo\'lmaydi; o\'zini ham', async () => {
    const [admin, second] = await seedUsers([{}, { id: 'u2', login: 'ikkinchi', role: 'admin' }])
    expect(updateUser(admin.id, admin.id, { status: 'blocked' })).toMatchObject({ ok: false, field: 'status' })
    expect(updateUser(admin.id, admin.id, { role: 'viewer' })).toMatchObject({ ok: false, field: 'role' })
    // Ikkinchi administrator kuzatuvchiga aylantiriladi — ruxsat (birinchisi qoladi)
    expect(updateUser(admin.id, second.id, { role: 'viewer' }).ok).toBe(true)
    // Endi faqat bitta administrator: uni ikkinchisi ham tushira olmaydi
    expect(updateUser(second.id, admin.id, { role: 'manager' })).toMatchObject({ ok: false, error: 'Kamida bitta faol administrator qolishi kerak' })
  })

  it('bloklash va blokdan chiqarish', async () => {
    const [admin, staff] = await seedUsers([{}, { id: 'u2', login: 'kassir', role: 'cashier' }])
    expect(updateUser(admin.id, staff.id, { status: 'blocked' }).ok).toBe(true)
    expect(loadUsers()[1].status).toBe('blocked')
    expect(updateUser(admin.id, staff.id, { status: 'active' }).ok).toBe(true)
  })

  it('parolni tiklash: yangi vaqtinchalik parol, eskisi ishlamaydi', async () => {
    await seedUsers([{}, { id: 'u2', login: 'kassir', role: 'cashier', password: 'kassirParol1' }])
    const result = await resetPassword('u2')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.user.mustChange).toBe(true)
    expect((await authenticate('kassir', 'kassirParol1')).ok).toBe(false)
    expect((await authenticate('kassir', result.password)).ok).toBe(true)
  })
})

describe('o\'z hisobi', () => {
  it('majburiy parol almashtirish: vaqtinchalik parolni qayta qo\'yib bo\'lmaydi', async () => {
    await seedUsers([{ mustChange: true, password: 'Vaqtincha22' }])
    expect(await completePasswordChange('u-test', 'Vaqtincha22')).toMatchObject({ ok: false, field: 'password' })
    const result = await completePasswordChange('u-test', 'MeningParolim9')
    expect(result.ok && result.user.mustChange).toBe(false)
    expect((await authenticate('direktor', 'MeningParolim9')).ok).toBe(true)
  })

  it('login va parolni almashtirish joriy parol bilan; band login rad etiladi', async () => {
    await seedUsers([{}, { id: 'u2', login: 'malika', role: 'manager' }])
    expect(await changeOwnCredentials('u-test', 'xato', 'direktor', 'YangiParol9')).toMatchObject({ field: 'current' })
    expect(await changeOwnCredentials('u-test', 'maxfiyParol1', 'malika', '')).toMatchObject({ field: 'login' })
    expect(await changeOwnCredentials('u-test', 'maxfiyParol1', 'direktor', 'qisqa')).toMatchObject({ field: 'password' })
    expect((await changeOwnCredentials('u-test', 'maxfiyParol1', 'rahbar', 'YangiParol9')).ok).toBe(true)
    expect((await authenticate('rahbar', 'YangiParol9')).ok).toBe(true)
  })

  it('profil: ism va lavozim', async () => {
    await seedUsers()
    expect(updateOwnProfile('u-test', 'A', '')).toMatchObject({ ok: false, field: 'fullName' })
    expect(updateOwnProfile('u-test', '  Aziz Rahimov ', ' Direktor ')).toMatchObject({ ok: true, user: { fullName: 'Aziz Rahimov', title: 'Direktor' } })
  })
})

describe('demo xodimlar', () => {
  it('har rol uchun bittadan, tekshiruvdan o\'tadi, parol bilan kirib bo\'lmaydi', () => {
    const staff = createDemoStaff()
    expect(staff.map((u) => u.role)).toEqual(['admin', 'manager', 'cashier', 'viewer'])
    expect(staff.every(isStaffUser)).toBe(true)
  })
})
