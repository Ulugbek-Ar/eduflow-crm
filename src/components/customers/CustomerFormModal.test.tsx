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
