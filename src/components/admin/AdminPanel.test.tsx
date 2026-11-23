// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { authenticate } from '../../services/users.service'
import { makeCustomer, makeTransaction, renderApp, renderSignedIn, seedData, seedSession, seedUsers } from '../../test/helpers'

async function openAdmin(user: Awaited<ReturnType<typeof renderSignedIn>>['user']) {
  await user.click(screen.getByRole('button', { name: 'Boshqaruv' }))
  return screen.findByRole('region', { name: 'Xodimlar' })
}

describe('Boshqaruv: xodimlar', () => {
  it('xodim qo\'shiladi: vaqtinchalik parol bir marta ko\'rsatiladi va u bilan kirish mumkin', async () => {
    const { user } = await renderSignedIn()
    const card = await openAdmin(user)
    await user.click(within(card).getByRole('button', { name: 'Xodim qo\'shish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi xodim' })
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Malika Yusupova')
    await user.type(within(dialog).getByLabelText(/^Login/), 'malika')
    await user.click(within(dialog).getByLabelText(/Kassir \/ Buxgalter/))
    const password = (within(dialog).getByLabelText('Vaqtinchalik parol') as HTMLInputElement).value
    expect(password).toHaveLength(10)
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))

    const issued = await screen.findByRole('dialog', { name: 'Xodim qo\'shildi' }, { timeout: 4000 })
    expect((within(issued).getByLabelText('Vaqtinchalik parol') as HTMLInputElement).value).toBe(password)
    await user.click(within(issued).getByRole('button', { name: 'Tayyor' }))

    const row = within(card).getByText('Malika Yusupova').closest('tr') as HTMLElement
    expect(within(row).getByText('Kassir / Buxgalter')).toBeTruthy()
    expect(within(row).getByText('Parol kutilmoqda')).toBeTruthy()
    const result = await authenticate('malika', password)
    expect(result.ok && result.user.mustChange).toBe(true)
  })

  it('bloklash: tasdiqdan keyin xodim kira olmaydi, o\'zini bloklash tugmasi yo\'q', async () => {
    await seedUsers([{}, { id: 'u2', login: 'kassir', fullName: 'Sardor Qodirov', role: 'cashier' }])
    seedSession()
    seedData()
    const { user } = renderApp()
    const card = await openAdmin(user)
    expect(within(card).queryByRole('button', { name: 'Bloklash: Dilshod Karimov' })).toBeNull()
    await user.click(within(card).getByRole('button', { name: 'Bloklash: Sardor Qodirov' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Bloklash' }))
    expect(await screen.findByText('Sardor Qodirov bloklandi')).toBeTruthy()
    expect(within(card).getByText('Bloklangan')).toBeTruthy()
    expect(await authenticate('kassir', 'maxfiyParol1')).toEqual({ ok: false, reason: 'blocked' })
  })

  it('o\'z rolini o\'zgartirib bo\'lmaydi; parolni tiklash yangi parol beradi', async () => {
    await seedUsers([{}, { id: 'u2', login: 'kassir', fullName: 'Sardor Qodirov', role: 'cashier' }])
    seedSession()
    seedData()
    const { user } = renderApp()
    const card = await openAdmin(user)
    await user.click(within(card).getByRole('button', { name: 'Tahrirlash: Dilshod Karimov' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xodimni tahrirlash' })
    expect(within(dialog).getByLabelText(/Menejer/).matches(':disabled')).toBe(true)
    await user.click(within(dialog).getByRole('button', { name: 'Bekor qilish' }))

    await user.click(within(card).getByRole('button', { name: 'Parolni tiklash: Sardor Qodirov' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yangi parol yaratish' }))
    const issued = await screen.findByRole('dialog', { name: 'Yangi vaqtinchalik parol' }, { timeout: 4000 })
    const password = (within(issued).getByLabelText('Vaqtinchalik parol') as HTMLInputElement).value
    expect((await authenticate('kassir', password)).ok).toBe(true)
  })

  it('seanslar: boshqa seanslar "Hammani chiqarish" bilan yopiladi', async () => {
    await renderSignedIn()
    const now = new Date().toISOString()
    const sessions = JSON.parse(localStorage.getItem('apex:sessions') ?? '[]') as unknown[]
    localStorage.setItem('apex:sessions', JSON.stringify([...sessions, { id: 's-other', userId: 'u-test', startedAt: now, lastSeenAt: now, device: 'Safari · iOS' }]))
    const { user } = renderApp()
    // Ikkinchi render — yangi tab: seanslar ro'yxati qaytadan o'qiladi
    await user.click(screen.getAllByRole('button', { name: 'Boshqaruv' })[1])
    await user.click(screen.getAllByRole('tab', { name: 'Seanslar' })[0])
    const card = await screen.findByRole('region', { name: 'Ochiq seanslar' })
    expect(within(card).getByText(/Safari · iOS/)).toBeTruthy()
    await user.click(within(card).getByRole('button', { name: 'Hammani chiqarish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Hammasini yopish' }))
    expect(within(card).queryByText(/Safari · iOS/)).toBeNull()
    expect((JSON.parse(localStorage.getItem('apex:sessions') ?? '[]') as unknown[]).length).toBe(1)
  })
})

describe('Rollar bo\'yicha cheklovlar', () => {
  const data = { customers: [makeCustomer()], transactions: [makeTransaction()] }

  it('kuzatuvchi: qo\'shish, tahrirlash va o\'chirish tugmalari yo\'q', async () => {
    const { user } = await renderSignedIn(data, { role: 'viewer' })
    // Tezkor amallarda faqat ko'rish (Qarzdorlar) qoladi
    expect(screen.queryByRole('button', { name: /^Yangi lid Mijoz/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Qarzdorlar/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Hisobot yuklash' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await screen.findByRole('heading', { name: 'Mijozlar va lidlar', level: 2 })
    expect(screen.queryByRole('button', { name: 'Yangi mijoz' })).toBeNull()
    expect(screen.queryByRole('button', { name: /ni tahrirlash$/ })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Aziza Karimova holati' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    await screen.findByRole('heading', { name: 'Tranzaksiyalar jurnali' })
    expect(screen.queryByRole('button', { name: 'To\'lov qabul qilish' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tranzaksiyani o\'chirish' })).toBeNull()
    // "N" tezkor tugmasi ham ishlamaydi
    await user.keyboard('n')
    expect(screen.queryByRole('dialog', { name: 'Yangi mijoz' })).toBeNull()
  })

  it('menejer: mijoz qo\'shadi va to\'lov qabul qiladi, xarajat yozolmaydi va sozlamalarni o\'zgartirolmaydi', async () => {
    const { user } = await renderSignedIn(data, { role: 'manager' })
    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    await screen.findByRole('heading', { name: 'Tranzaksiyalar jurnali' })
    expect(screen.getAllByRole('button', { name: 'To\'lov qabul qilish' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Xarajat' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /^Status:/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    expect(await screen.findByRole('region', { name: 'Profil va xavfsizlik' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Tashkilot' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Ma\'lumotlar' })).toBeNull()
  })
})
