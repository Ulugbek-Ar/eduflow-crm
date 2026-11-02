// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeCustomer, makeTransaction, plain, renderSignedIn } from '../../test/helpers'

const customers = [
  makeCustomer({ id: 'c1', name: 'Aziza Karimova', status: 'active', phone: '+998 90 111 11 11' }),
  makeCustomer({ id: 'c2', name: 'Bobur Aliyev', status: 'lead', phone: '+998 90 222 22 22', source: 'telegram' }),
  makeCustomer({ id: 'c3', name: 'Dilnoza Sobirova', status: 'lead', phone: '+998 90 333 33 33' }),
]

describe('Mijozlar jadvali', () => {
  it('holat va qidiruv filtrlari natijani toraytiradi', async () => {
    const { user } = await renderSignedIn({ customers })
    await user.click(screen.getByRole('button', { name: 'Mijozlar' }))
    const section = await screen.findByRole('region', { name: 'Mijozlar bazasi' })
    expect(within(section).getByText('3 ta natija (jami 3)')).toBeTruthy()

    await user.selectOptions(within(section).getByLabelText('Holat'), 'lead')
    expect(within(section).getByText('2 ta natija (jami 3)')).toBeTruthy()
    expect(within(section).queryByText('Aziza Karimova')).toBeNull()

    await user.type(screen.getByRole('searchbox', { name: 'Qidiruv' }), 'Dilnoza')
    expect(within(section).getByText('1 ta natija (jami 3)')).toBeTruthy()

    await user.selectOptions(within(section).getByLabelText('Manba'), 'telegram')
    expect(within(section).getByText('0 ta natija (jami 3)')).toBeTruthy()
  })

  it('o\'chirishda to\'lovlar soni va summasi ko\'rsatiladi, jurnalda "(o\'chirilgan)" bilan qoladi', async () => {
    const { user } = await renderSignedIn({
      customers,
      transactions: [makeTransaction({ id: 't1', amount: 500_000 }), makeTransaction({ id: 't2', amount: 300_000 })],
    })
    await user.click(screen.getByRole('button', { name: 'Mijozlar' }))
    await user.click(await screen.findByRole('button', { name: 'Aziza Karimovani o\'chirish' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Mijozni o\'chirish' })
    expect(plain(confirm.textContent)).toContain('2 ta to\'lov (jami 800 000 so\'m)')
    await user.click(within(confirm).getByRole('button', { name: 'O\'chirish' }))

    await user.click(screen.getByRole('button', { name: 'Moliya' }))
    const journal = await screen.findByRole('region', { name: 'Tranzaksiyalar jurnali' })
    expect(within(journal).getAllByText('Aziza Karimova (o\'chirilgan)')).toHaveLength(2)
  })
})
