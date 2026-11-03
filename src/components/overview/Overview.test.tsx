// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeCustomer, makeTransaction, plain, renderSignedIn } from '../../test/helpers'

const today = new Date().toISOString()

describe('Umumiy ko\'rinish', () => {
  it('4 ta KPI: Jami tushum, Faol mijozlar, Yangi lidlar, Konversiya', async () => {
    await renderSignedIn({
      customers: [
        makeCustomer({ id: 'a', status: 'paid', createdAt: today, phone: '+998 90 000 00 01' }),
        makeCustomer({ id: 'b', status: 'new', createdAt: today, phone: '+998 90 000 00 02' }),
        makeCustomer({ id: 'c', status: 'thinking', createdAt: today, phone: '+998 90 000 00 03' }),
        makeCustomer({ id: 'd', status: 'paid', createdAt: today, phone: '+998 90 000 00 04' }),
      ],
      transactions: [
        makeTransaction({ id: 't1', amount: 800_000, date: today, customerId: 'a' }),
        makeTransaction({ id: 't2', amount: 500_000, date: today, customerId: 'b', status: 'pending', note: 'Kutilayotgan' }),
      ],
    })
    const kpis = screen.getByRole('region', { name: /Asosiy ko'rsatkichlar/ })
    const value = (title: string) => plain(within(kpis).getByRole('heading', { name: title }).nextElementSibling?.textContent)
    expect(value('Jami tushum')).toBe('800 000 so\'m')
    expect(value('Faol mijozlar')).toBe('2')
    expect(value('Yangi lidlar')).toBe('4')
    expect(value('Konversiya')).toBe('50%')
  })

  it('so\'nggi amallar lentasi yangi bosqich va to\'lov statusini ko\'rsatadi', async () => {
    await renderSignedIn({
      customers: [makeCustomer({ status: 'contacted', createdAt: new Date(Date.now() - 60_000).toISOString() })],
      transactions: [makeTransaction({ amount: 500_000, date: today, status: 'pending', note: 'Fevral to\'lovi' })],
    })
    const feed = screen.getByRole('region', { name: 'So\'nggi amallar' })
    expect(within(feed).getByText('Yangi lid: Aziza Karimova')).toBeTruthy()
    expect(within(feed).getByText('Bog\'lanildi')).toBeTruthy()
    expect(within(feed).getByText('Kutilmoqda')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Oylik tushum va xarajatlar' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Manbalar taqsimoti' })).toBeTruthy()
  })
})
