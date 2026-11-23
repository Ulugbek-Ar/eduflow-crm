// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createBackup, createEmptyData } from '../../services/storage.service'
import { makeCustomer, makeTransaction, renderSignedIn } from '../../test/helpers'

async function openDataSettings(user: Awaited<ReturnType<typeof renderSignedIn>>['user']) {
  await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
  return screen.findByRole('region', { name: 'Ma\'lumotlar' })
}

describe('Zaxiradan tiklash', () => {
  it('faylni oldindan ko\'rsatib, tasdiqlangach ma\'lumotni almashtiradi', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer()] })
    const section = await openDataSettings(user)

    const backup = createBackup({
      ...createEmptyData(),
      customers: [makeCustomer({ id: 'b1', name: 'Zaxira Mijoz' }), makeCustomer({ id: 'b2', name: 'Ikkinchi', phone: '+998 91 000 00 00' })],
      transactions: [makeTransaction({ customerId: 'b1', customerName: 'Zaxira Mijoz' })],
    })
    const file = new File([JSON.stringify(backup)], 'zaxira.json', { type: 'application/json' })
    await user.upload(within(section).getByLabelText('Zaxira faylini tanlash'), file)

    const preview = await within(section).findByRole('region', { name: 'Import oldindan ko\'rish' })
    expect(within(preview).getByText('zaxira.json')).toBeTruthy()
    expect(within(preview).getByText(/2 mijoz, 1 tranzaksiya/)).toBeTruthy()
    await user.click(within(preview).getByRole('button', { name: 'Almashtirish' }))

    const confirm = await screen.findByRole('alertdialog', { name: 'Zaxirani tiklash' })
    await user.click(within(confirm).getByRole('button', { name: 'Almashtirish' }))

    expect(await screen.findByText('Zaxira tiklandi: 2 mijoz, 1 tranzaksiya')).toBeTruthy()
    const stored = JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<{ name: string }>
    expect(stored.map((c) => c.name)).toEqual(['Zaxira Mijoz', 'Ikkinchi'])
  })

  it('buzuq faylda xato ko\'rsatadi va ma\'lumotga tegmaydi', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer()] })
    const section = await openDataSettings(user)
    await user.upload(within(section).getByLabelText('Zaxira faylini tanlash'), new File(['{buzuq'], 'x.json', { type: 'application/json' }))
    expect((await within(section).findByRole('alert')).textContent).toBe('Fayl JSON formatida emas yoki buzilgan')
    expect(JSON.parse(localStorage.getItem('apex:customers') ?? '[]')).toHaveLength(1)
  })

  it('taxminiy band joyni KB va % da ko\'rsatadi', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer()] })
    const section = await openDataSettings(user)
    expect(within(section).getByText('Band joy (taxminiy)')).toBeTruthy()
    expect(within(section).getByText(/KB \/ ~5 MB · \d+,\d%/)).toBeTruthy()
    expect(within(section).getByRole('meter', { name: 'Band joy (taxminiy)' })).toBeTruthy()
  })
})
