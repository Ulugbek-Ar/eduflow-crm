// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeCustomer, plain, renderSignedIn } from '../../test/helpers'

describe('To\'lov qo\'shish', () => {
  it('summa formatlanadi, to\'lov jurnalga mijoz nomi bilan yoziladi', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer()] })
    await user.click(screen.getByRole('button', { name: 'Moliya' }))
    await user.click(await screen.findByRole('button', { name: 'To\'lov qabul qilish' }))
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })

    const amount = within(dialog).getByLabelText(/Summa/) as HTMLInputElement
    await user.type(amount, '650000')
    expect(plain(amount.value)).toBe('650 000')

    await user.type(within(dialog).getByLabelText(/Mijoz/), 'Aziza')
    await user.click(await within(dialog).findByRole('option', { name: /Aziza Karimova/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    expect(await screen.findByText((text) => plain(text) === 'To\'lov qayd etildi: 650 000 so\'m')).toBeTruthy()
    const journal = screen.getByRole('region', { name: 'Tranzaksiyalar jurnali' })
    expect(within(journal).getByText('1 ta yozuv', { exact: false })).toBeTruthy()
    expect(within(journal).getByRole('button', { name: 'Aziza Karimova' })).toBeTruthy()

    const stored = JSON.parse(localStorage.getItem('apex:transactions') ?? '[]') as Array<{ customerName?: string; amount: number }>
    expect(stored[0]).toMatchObject({ amount: 650_000, customerName: 'Aziza Karimova' })
  })

  it('summasiz saqlab bo\'lmaydi', async () => {
    const { user } = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Moliya' }))
    await user.click(await screen.findByRole('button', { name: 'To\'lov qabul qilish' }))
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect(screen.getByRole('dialog', { name: 'To\'lov qabul qilish' })).toBeTruthy()
    expect(localStorage.getItem('apex:transactions')).toBe('[]')
  })
})
