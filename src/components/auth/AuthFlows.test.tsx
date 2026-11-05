// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getStorageNamespace } from '../../services/storage.service'
import {
  makeCustomer,
  renderApp,
  renderSignedIn,
  seedData,
  seedLegacyCredentials,
  seedUsers,
  TEST_LOGIN,
  TEST_PASSWORD,
} from '../../test/helpers'

async function login(user: ReturnType<typeof renderApp>['user'], name: string, password: string) {
  await user.type(screen.getByLabelText('Login'), name)
  await user.type(screen.getByLabelText('Parol'), password)
  await user.click(screen.getByRole('button', { name: 'Kirish' }))
}

describe('Ro\'yxatdan o\'tish (birinchi ishga tushish)', () => {
  it('standart parol yo\'q: administrator hisobi yaratiladi va markaz nomi saqlanadi', async () => {
    const { user } = renderApp()
    expect(screen.getByRole('heading', { name: 'Markazni ro\'yxatdan o\'tkazish' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('admin123')

    await user.type(screen.getByLabelText(/O'quv markazi nomi/), 'Bilim Plus')
    await user.type(screen.getByLabelText(/Ism familiyangiz/), 'Dilshod Karimov')
    await user.type(screen.getByLabelText(/^Login/, { selector: 'input' }), 'dilshod')
    await user.type(screen.getByLabelText(/^Parol( \*)?$/, { selector: 'input' }), 'Toshkent2026')
    await user.type(screen.getByLabelText(/Parolni takrorlang/), 'Toshkent2027')
    await user.click(screen.getByRole('button', { name: 'Hisob yaratish' }))
    expect(await screen.findByText('Parollar mos kelmadi')).toBeTruthy()

    await user.clear(screen.getByLabelText(/Parolni takrorlang/))
    await user.type(screen.getByLabelText(/Parolni takrorlang/), 'Toshkent2026')
    await user.click(screen.getByRole('button', { name: 'Hisob yaratish' }))
    expect(await screen.findByRole('heading', { name: 'Xush kelibsiz!' }, { timeout: 4000 })).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('apex:settings') ?? '{}')).toMatchObject({ orgName: 'Bilim Plus' })

    await user.click(screen.getByRole('button', { name: /Bo'sh boshlash/ }))
    expect(await screen.findByText('Bilim Plus')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('apex:settings') ?? '{}')).toMatchObject({ orgName: 'Bilim Plus' })
  })

  it('juda oddiy parol qabul qilinmaydi', async () => {
    const { user } = renderApp()
    await user.type(screen.getByLabelText(/O'quv markazi nomi/), 'Bilim Plus')
    await user.type(screen.getByLabelText(/Ism familiyangiz/), 'Dilshod Karimov')
    await user.type(screen.getByLabelText(/^Login/, { selector: 'input' }), 'dilshod')
    await user.type(screen.getByLabelText(/^Parol( \*)?$/, { selector: 'input' }), '12345678')
    await user.type(screen.getByLabelText(/Parolni takrorlang/), '12345678')
    await user.click(screen.getByRole('button', { name: 'Hisob yaratish' }))
    expect(await screen.findByText(/taxmin qilish juda oson/)).toBeTruthy()
  })
})

describe('Kirish', () => {
  it('kirish sahifasida standart login yoki parol ko\'rsatilmaydi', async () => {
    await seedUsers()
    renderApp()
    expect(screen.getByRole('button', { name: 'Kirish' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/admin123|Standart kirish/)
    expect(screen.getByRole('button', { name: 'Demo\'ni ko\'rish' })).toBeTruthy()
  })

  it('bloklangan xodim kira olmaydi', async () => {
    await seedUsers([{ status: 'blocked' }])
    const { user } = renderApp()
    await login(user, TEST_LOGIN, TEST_PASSWORD)
    expect(await screen.findByText('Hisobingiz bloklangan. Administratorga murojaat qiling.')).toBeTruthy()
  })

  it('vaqtinchalik parol bilan kirgach — yangi parol majburiy', async () => {
    await seedUsers([{ mustChange: true, password: 'Vaqtincha22' }])
    seedData()
    const { user } = renderApp()
    await login(user, TEST_LOGIN, 'Vaqtincha22')
    expect(await screen.findByRole('heading', { name: 'Yangi parol o\'rnating' })).toBeTruthy()

    await user.type(screen.getByLabelText(/^Yangi parol/, { selector: 'input' }), 'Vaqtincha22')
    await user.type(screen.getByLabelText(/Parolni takrorlang/), 'Vaqtincha22')
    await user.click(screen.getByRole('button', { name: 'Saqlash va davom etish' }))
    expect(await screen.findByText('Yangi parol vaqtinchalik paroldan farq qilishi kerak', {}, { timeout: 4000 })).toBeTruthy()

    await user.clear(screen.getByLabelText(/^Yangi parol/, { selector: 'input' }))
    await user.clear(screen.getByLabelText(/Parolni takrorlang/))
    await user.type(screen.getByLabelText(/^Yangi parol/, { selector: 'input' }), 'MeningParolim9')
    await user.type(screen.getByLabelText(/Parolni takrorlang/), 'MeningParolim9')
    await user.click(screen.getByRole('button', { name: 'Saqlash va davom etish' }))
    expect(await screen.findByRole('navigation', { name: 'Bo\'limlar' }, { timeout: 4000 })).toBeTruthy()
  })

  it('27-bosqichgacha bo\'lgan login va ochiq seans: qayta kirish so\'ralmaydi', async () => {
    await seedLegacyCredentials()
    seedData({ customers: [makeCustomer()] })
    sessionStorage.setItem('apex:session', JSON.stringify({ login: TEST_LOGIN, startedAt: new Date().toISOString() }))
    renderApp()
    expect(await screen.findByRole('navigation', { name: 'Bo\'limlar' })).toBeTruthy()
    const users = JSON.parse(localStorage.getItem('apex:users') ?? '[]') as Array<{ login: string; role: string }>
    expect(users).toMatchObject([{ login: TEST_LOGIN, role: 'admin' }])
  })

  it('boshqa tabda seans yopilsa — bu tab ham chiqadi', async () => {
    await renderSignedIn()
    expect(screen.getByRole('navigation', { name: 'Bo\'limlar' })).toBeTruthy()
    act(() => {
      localStorage.setItem('apex:sessions', '[]')
      window.dispatchEvent(new StorageEvent('storage', { key: 'apex:sessions', storageArea: localStorage }))
    })
    expect(await screen.findByRole('button', { name: 'Kirish' })).toBeTruthy()
    expect(await screen.findByText('Seansingiz yopildi. Qaytadan kiring.')).toBeTruthy()
  })
})

describe('Demo rejim', () => {
  it('haqiqiy ma\'lumotga tegmaydi, rollarni sinash mumkin, chiqishda o\'chadi', async () => {
    await seedUsers()
    seedData({ customers: [makeCustomer({ name: 'Haqiqiy Mijoz' })] })
    const before = localStorage.getItem('apex:customers')
    const { user } = renderApp()

    await user.click(screen.getByRole('button', { name: 'Demo\'ni ko\'rish' }))
    const bar = await screen.findByRole('region', { name: 'Demo rejim' })
    expect(getStorageNamespace()).toBe('demo')
    expect(screen.getByRole('button', { name: 'Profil: Dilshod Rahimov' })).toBeTruthy()
    expect(within(screen.getByRole('navigation', { name: 'Bo\'limlar' })).getByRole('button', { name: 'Boshqaruv' })).toBeTruthy()
    // Haqiqiy kalitlar o'zgarmagan, demo alohida
    expect(localStorage.getItem('apex:customers')).toBe(before)
    expect(JSON.parse(localStorage.getItem('eduflow-demo:customers') ?? '[]').length).toBeGreaterThan(5)

    await user.selectOptions(within(bar).getByRole('combobox'), 'viewer')
    expect(await screen.findByRole('button', { name: 'Profil: Nodira Karimova' })).toBeTruthy()
    expect(within(screen.getByRole('navigation', { name: 'Bo\'limlar' })).queryByRole('button', { name: 'Boshqaruv' })).toBeNull()

    await user.click(within(screen.getByRole('region', { name: 'Demo rejim' })).getByRole('button', { name: 'Demo\'dan chiqish' }))
    expect(await screen.findByRole('button', { name: 'Kirish' })).toBeTruthy()
    expect(getStorageNamespace()).toBe('main')
    expect(Object.keys(localStorage).some((k) => k.startsWith('eduflow-demo:'))).toBe(false)
    expect(localStorage.getItem('apex:customers')).toBe(before)
  })

  it('demo tabi yangilansa demo davom etadi', async () => {
    await seedUsers()
    const { user, unmount } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Demo\'ni ko\'rish' }))
    await screen.findByRole('region', { name: 'Demo rejim' })
    unmount()
    renderApp()
    expect(await screen.findByRole('region', { name: 'Demo rejim' })).toBeTruthy()
  })
})
