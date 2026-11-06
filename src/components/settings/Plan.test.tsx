// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { saveSubscription } from '../../services/subscription.service'
import { makeCustomer, renderApp, renderSignedIn, seedData, seedSession, seedUsers } from '../../test/helpers'

const DAY = 86_400_000

describe('Tarif', () => {
  it('Sozlamalarda tarif kartasi; sinov oxirida ogohlantirish', async () => {
    await seedUsers()
    seedSession()
    seedData()
    saveSubscription({ plan: 'trial', status: 'active', trialEndsAt: new Date(Date.now() + 2.5 * DAY).toISOString(), enforced: false })
    const { user } = renderApp()
    expect(await screen.findByText(/"Sinov" tarifi tugashiga 3 kun qoldi/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    const card = await screen.findByRole('region', { name: 'Tarif' })
    expect(within(card).getByText('Sinov')).toBeTruthy()
    expect(within(card).getByText('1 / 3')).toBeTruthy()
    expect(within(card).getByText(/Lokal rejim/)).toBeTruthy()
  })

  it('xodimlar soni tarif chegarasida', async () => {
    await seedUsers([{}, { id: 'u2', login: 'malika', role: 'manager' }, { id: 'u3', login: 'sardor', role: 'cashier' }])
    seedSession()
    seedData()
    saveSubscription({ plan: 'trial', status: 'active', trialEndsAt: new Date(Date.now() + 10 * DAY).toISOString(), enforced: false })
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Boshqaruv' }))
    await user.click(await screen.findByRole('button', { name: 'Xodim qo\'shish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi xodim' })
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Yangi Xodim')
    await user.type(within(dialog).getByLabelText(/^Login/), 'yangi')
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
    expect(await within(dialog).findByText(/Tarifingizda 3 tagacha xodim/)).toBeTruthy()
  })

  it('bulutli (majburiy) rejimda muddati tugasa — faqat ko\'rish', async () => {
    saveSubscription({ plan: 'standard', status: 'active', paidUntil: new Date(Date.now() - DAY).toISOString(), enforced: true })
    const { user } = await renderSignedIn({ customers: [makeCustomer()] })
    expect(screen.getByText(/tarifi muddati tugadi/)).toBeTruthy()
    expect(screen.getByText(/faqat ko'rish mumkin/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await screen.findByRole('heading', { name: 'Mijozlar va lidlar', level: 2 })
    expect(screen.queryByRole('button', { name: 'Yangi mijoz' })).toBeNull()
    expect(screen.queryByRole('button', { name: /ni o'chirish$/ })).toBeNull()
  })
})
