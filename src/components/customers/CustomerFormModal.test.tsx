// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeCustomer, renderSignedIn } from '../../test/helpers'

async function openForm(user: Awaited<ReturnType<typeof renderSignedIn>>['user']) {
  await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
  await user.click(await screen.findByRole('button', { name: 'Yangi mijoz' }))
  return screen.findByRole('dialog', { name: 'Yangi mijoz' })
}

describe('Mijoz qo\'shish', () => {
  it('telefon raqami +998 XX XXX XX XX ko\'rinishida formatlanadi', async () => {
    const { user } = await renderSignedIn()
    const dialog = await openForm(user)
    const phone = within(dialog).getByLabelText(/Telefon/) as HTMLInputElement
    await user.type(phone, '901234567999')
    expect(phone.value).toBe('+998 90 123 45 67')
  })

  it('yangi mijoz qo\'shiladi va ro\'yxatda ko\'rinadi', async () => {
    const { user } = await renderSignedIn()
    const dialog = await openForm(user)
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Bobur Aliyev')
    await user.type(within(dialog).getByLabelText(/Telefon/), '935554433')
    await user.click(within(dialog).getByRole('button', { name: "Qo'shish" }))
    expect(await screen.findByText('"Bobur Aliyev" mijozlar bazasiga qo\'shildi')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByText('Bobur Aliyev').length).toBeGreaterThan(0)
  })

  it('takroriy telefon raqami rad etiladi', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer()] })
    const dialog = await openForm(user)
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Boshqa Odam')
    await user.type(within(dialog).getByLabelText(/Telefon/), '901234567')
    await user.click(within(dialog).getByRole('button', { name: "Qo'shish" }))
    expect(within(dialog).getByText('Bu raqam "Aziza Karimova" mijozida mavjud')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Yangi mijoz' })).toBeTruthy()
  })

  it('noto\'liq telefon raqamida xato', async () => {
    const { user } = await renderSignedIn()
    const dialog = await openForm(user)
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Bobur Aliyev')
    await user.type(within(dialog).getByLabelText(/Telefon/), '90123')
    await user.click(within(dialog).getByRole('button', { name: "Qo'shish" }))
    expect(within(dialog).getByText('Telefon +998 XX XXX XX XX formatida bo\'lishi kerak')).toBeTruthy()
  })
})

describe('Yangi mijoz formasi (voronka)', () => {
  it('maydonlar: Ism, Telefon, Manba, Kurs / xizmat, Izoh; yangi mijoz "Yangi" bosqichida', async () => {
    const { user } = await renderSignedIn()
    const dialog = await openForm(user)
    expect(within(dialog).queryByLabelText(/Email/)).toBeNull()
    expect(within(dialog).queryByLabelText('Bosqich')).toBeNull()
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Bobur Aliyev')
    await user.type(within(dialog).getByLabelText(/Telefon/), '935554433')
    await user.selectOptions(within(dialog).getByLabelText('Manba'), 'telegram')
    await user.selectOptions(within(dialog).getByLabelText('Kurs / xizmat'), 'Python asoslari')
    await user.type(within(dialog).getByLabelText('Izoh'), 'Kechki guruh')
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
    const stored = JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<Record<string, string>>
    expect(stored[0]).toMatchObject({ name: 'Bobur Aliyev', status: 'new', source: 'telegram', course: 'Python asoslari', note: 'Kechki guruh' })
  })

  it('tahrirlashda bosqichni ham o\'zgartirish mumkin', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer({ status: 'new' })] })
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Aziza Karimovani tahrirlash' }))
    const dialog = await screen.findByRole('dialog', { name: 'Mijozni tahrirlash' })
    await user.selectOptions(within(dialog).getByLabelText('Bosqich'), 'paid')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect((JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<{ status: string }>)[0].status).toBe('paid')
  })
})
