// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeCustomer, renderSignedIn } from '../test/helpers'

const MESSAGE = 'Ma\'lumot saqlanmadi: brauzer xotirasi to\'lgan. JSON zaxira oling.'

async function addCustomer(user: Awaited<ReturnType<typeof renderSignedIn>>['user'], name: string, phone: string) {
  await user.click(await screen.findByRole('button', { name: 'Yangi mijoz' }))
  const dialog = await screen.findByRole('dialog', { name: 'Yangi mijoz' })
  await user.type(within(dialog).getByLabelText(/Ism familiya/), name)
  await user.type(within(dialog).getByLabelText(/Telefon/), phone)
  await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
}

describe('Saqlash xatosi toast\'i', () => {
  it('xotira to\'lsa aniq xabar chiqadi va takrorlanmaydi', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer()] })
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))

    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith('apex:customers')) throw new DOMException('to\'ldi', 'QuotaExceededError')
      realSetItem.call(this, key, value)
    })

    await addCustomer(user, 'Bobur Aliyev', '935554433')
    expect(await screen.findByText(MESSAGE)).toBeTruthy()

    await addCustomer(user, 'Dilnoza Sobirova', '935554434')
    await screen.findByText('"Dilnoza Sobirova" mijozlar bazasiga qo\'shildi')
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1)

    // Xotira bo'shagach, keyingi saqlash muvaffaqiyatli — ma'lumot yo'qolmaydi
    vi.mocked(Storage.prototype.setItem).mockRestore()
    await addCustomer(user, 'Jasur Toshev', '935554435')
    await screen.findByText('"Jasur Toshev" mijozlar bazasiga qo\'shildi')
    const stored = JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<{ name: string }>
    expect(stored.map((c) => c.name)).toEqual(['Jasur Toshev', 'Dilnoza Sobirova', 'Bobur Aliyev', 'Aziza Karimova'])
  })
})
