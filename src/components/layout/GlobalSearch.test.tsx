// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeCustomer, makeTransaction, renderSignedIn } from '../../test/helpers'

const data = {
  customers: [makeCustomer({ id: 'c1', name: 'Aziza Karimova' }), makeCustomer({ id: 'c2', name: 'Bobur Aliyev', phone: '+998 91 222 33 44' })],
  transactions: [makeTransaction({ id: 't1', customerId: 'c1', note: 'IELTS 1-oy' })],
}

describe('Global qidiruv', () => {
  it('Umumiy ko\'rinishda natijalar oynasi: mijoz, kurs, tranzaksiya; tanlansa karta ochiladi', async () => {
    const { user } = await renderSignedIn(data)
    await user.keyboard('{Control>}k{/Control}')
    expect(document.activeElement?.id).toBe('global-search')
    await user.keyboard('aziza')
    const results = screen.getByRole('region', { name: 'Qidiruv natijalari' })
    expect(within(results).getByRole('button', { name: /^Aziza Karimova/ })).toBeTruthy()
    expect(within(results).getAllByRole('button', { name: /IELTS 1-oy/ })).toHaveLength(1)

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement?.textContent).toContain('Aziza Karimova')
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Aziza Karimova' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Qidiruv natijalari' })).toBeNull()
  })

  it('kurs bo\'yicha qidiruv va "topilmadi"; Escape yopadi', async () => {
    const { user } = await renderSignedIn(data)
    await user.click(screen.getByRole('searchbox', { name: 'Qidiruv' }))
    await user.keyboard('python')
    expect(within(screen.getByRole('region', { name: 'Qidiruv natijalari' })).getByRole('button', { name: /Python asoslari/ })).toBeTruthy()
    await user.clear(screen.getByRole('searchbox', { name: 'Qidiruv' }))
    await user.keyboard('zzzz')
    expect(screen.getByText('Hech narsa topilmadi')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Qidiruv natijalari' })).toBeNull()
  })

  it('ro\'yxatli bo\'limda (Mijozlar) oyna chiqmaydi — ro\'yxatning o\'zi filtrlanadi', async () => {
    const { user } = await renderSignedIn(data)
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(screen.getByRole('searchbox', { name: 'Qidiruv' }))
    await user.keyboard('bobur')
    expect(screen.queryByRole('region', { name: 'Qidiruv natijalari' })).toBeNull()
    expect(await screen.findByText('1 ta natija (jami 2)')).toBeTruthy()
  })
})
