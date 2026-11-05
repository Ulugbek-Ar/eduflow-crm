// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, makeTransaction, renderApp, renderSignedIn, seedUsers, TEST_LOGIN } from '../../test/helpers'

type User = Awaited<ReturnType<typeof renderSignedIn>>['user']

async function deleteCustomer(user: User, name: string) {
  await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
  await user.click(await screen.findByRole('button', { name: `${name}ni o'chirish` }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog.textContent).toContain('savatchaga o\'tkaziladi')
  await user.click(within(dialog).getByRole('button', { name: 'O\'chirish' }))
}

async function openAdminTab(user: User, tab: string) {
  await user.click(screen.getByRole('button', { name: 'Boshqaruv' }))
  await user.click(await screen.findByRole('tab', { name: new RegExp(`^${tab}`) }))
}

describe('Savatcha va "Bekor qilish"', () => {
  it('o\'chirilgan mijoz toast\'dagi "Bekor qilish" bilan qaytadi', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer()] })
    await deleteCustomer(user, 'Aziza Karimova')
    expect(await screen.findByText('"Aziza Karimova" savatchaga o\'tkazildi')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Aziza Karimova' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }))
    expect(await screen.findByRole('button', { name: 'Aziza Karimova' })).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('apex:trash') ?? '[]')).toEqual([])
  })

  it('savatchadan tiklash va butunlay o\'chirish; jurnalga yoziladi', async () => {
    const { user } = await renderSignedIn({
      customers: [makeCustomer(), makeCustomer({ id: 'c2', name: 'Bobur Aliyev', phone: '+998 93 555 44 33' })],
      transactions: [makeTransaction()],
    })
    await deleteCustomer(user, 'Aziza Karimova')
    await deleteCustomer(user, 'Bobur Aliyev')
    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    await user.click(await screen.findByRole('button', { name: 'Tranzaksiyani o\'chirish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'O\'chirish' }))

    await openAdminTab(user, 'Savatcha')
    const bin = await screen.findByRole('region', { name: 'Savatcha' })
    expect(within(bin).getAllByRole('listitem')).toHaveLength(3)
    expect(within(bin).getByText(/Kirim: 650 000 so'm · Aziza Karimova/)).toBeTruthy()
    expect(within(bin).getAllByText(/30 kun qoldi/).length).toBe(3)

    await user.click(within(bin).getByRole('button', { name: 'Tiklash: Aziza Karimova' }))
    await user.click(within(bin).getByRole('button', { name: 'Butunlay o\'chirish: Bobur Aliyev' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Butunlay o\'chirish' }))
    expect(within(bin).getAllByRole('listitem')).toHaveLength(1)

    const customers = JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<{ name: string }>
    expect(customers.map((c) => c.name)).toEqual(['Aziza Karimova'])

    await user.click(screen.getByRole('tab', { name: 'Amallar jurnali' }))
    const log = await screen.findByRole('region', { name: 'Amallar jurnali' })
    for (const text of ['Mijoz o\'chirildi', 'Tranzaksiya o\'chirildi', 'Mijoz tiklandi', 'Savatchadan butunlay o\'chirildi']) {
      expect(within(log).getAllByText(text).length).toBeGreaterThan(0)
    }
    expect(within(log).getAllByText('Dilshod Karimov').length).toBeGreaterThan(3)
  })

  it('tiklangan kurs nomi band bo\'lsa "(tiklangan)" qo\'shiladi', async () => {
    const [first] = createMockCourses()
    const { user } = await renderSignedIn({ courses: [{ ...first, id: 'k1', name: 'Python' }] })
    await user.click(screen.getByRole('button', { name: 'Kurslar va xizmatlar' }))
    await user.click(await screen.findByRole('button', { name: 'Pythonni o\'chirish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'O\'chirish' }))
    await user.click(screen.getAllByRole('button', { name: 'Yangi kurs' })[0])
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Nomi/), 'Python')
    await user.click(within(dialog).getByRole('button', { name: /Qo'shish|Saqlash/ }))
    await openAdminTab(user, 'Savatcha')
    await user.click(await screen.findByRole('button', { name: 'Tiklash: Python' }))
    const courses = JSON.parse(localStorage.getItem('apex:courses') ?? '[]') as Array<{ name: string }>
    expect(courses.map((c) => c.name).sort()).toEqual(['Python', 'Python (tiklangan)'])
  })
})

describe('Amallar jurnali', () => {
  it('kirish, noto\'g\'ri urinish va hisobot yuklash yoziladi; xodim bo\'yicha filtr', async () => {
    await seedUsers()
    const { user } = renderApp()
    await user.type(screen.getByLabelText('Login'), TEST_LOGIN)
    await user.type(screen.getByLabelText('Parol'), 'xato-parol')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await screen.findByText(/Login yoki parol noto'g'ri/)
    await user.type(screen.getByLabelText('Parol'), 'maxfiyParol1')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await user.click(await screen.findByRole('button', { name: 'Keyinroq sozlayman' }, { timeout: 4000 }))

    await openAdminTab(user, 'Amallar jurnali')
    const log = await screen.findByRole('region', { name: 'Amallar jurnali' })
    expect(within(log).getByText('Noto\'g\'ri kirish urinishi')).toBeTruthy()
    expect(within(log).getByText('Noto\'g\'ri login yoki parol: direktor')).toBeTruthy()
    expect(within(log).getByText('Tizimga kirdi')).toBeTruthy()
    // Parol jurnalga hech qachon tushmaydi
    expect(localStorage.getItem('apex:audit')).not.toContain('xato-parol')

    await user.click(within(log).getByRole('button', { name: 'Excel' }))
    expect(await within(log).findByText('Hisobot yuklab olindi')).toBeTruthy()

    await user.selectOptions(within(log).getByLabelText('Xodim'), 'u-test')
    expect(within(log).queryByText('Noto\'g\'ri kirish urinishi')).toBeNull()
    expect(within(log).getByText('Tizimga kirdi')).toBeTruthy()
  })
})
