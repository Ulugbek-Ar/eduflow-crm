// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, makeTransaction, plain, renderSignedIn } from '../../test/helpers'

const [ielts] = createMockCourses()
const today = new Date().toISOString()

const storedTx = () => JSON.parse(localStorage.getItem('apex:transactions') ?? '[]') as Array<Record<string, unknown>>
const tile = (label: RegExp) => plain(screen.getByText(label).nextElementSibling?.textContent)

async function openFinance(data: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(data)
  await view.user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
  await screen.findByRole('region', { name: 'Tranzaksiyalar jurnali' })
  return view
}

describe('Moliya va kassa', () => {
  it('balans, kirim va chiqim faqat "To\'langan" bo\'yicha; status jadvalda almashtiriladi', async () => {
    const { user } = await openFinance({
      customers: [makeCustomer({ course: ielts.name })],
      transactions: [
        makeTransaction({ id: 't1', amount: 500_000, date: today }),
        makeTransaction({ id: 't2', amount: 300_000, date: today, status: 'pending' }),
        makeTransaction({ id: 't3', type: 'expense', category: 'rent', customerId: undefined, customerName: undefined, amount: 100_000, date: today }),
      ],
    })
    expect(tile(/^Umumiy balans/)).toBe('400 000 so\'m')
    expect(tile(/^Jami kirim/)).toBe('500 000 so\'m')
    expect(tile(/^Jami chiqim/)).toBe('100 000 so\'m')

    const journal = screen.getByRole('region', { name: 'Tranzaksiyalar jurnali' })
    const headers = within(journal).getAllByRole('columnheader').map((th) => th.textContent?.trim())
    expect(headers.slice(0, 5)).toEqual(['Sana', 'Mijoz', 'Summa', 'To\'lov turi', 'Status'])

    const statusSelect = within(journal).getByRole('combobox', { name: /Status: Kirim 300/ })
    await user.selectOptions(statusSelect, 'paid')
    expect(tile(/^Umumiy balans/)).toBe('700 000 so\'m')
    expect(storedTx().find((t) => t.id === 't2')?.status).toBe('paid')
  })

  it('status filtri', async () => {
    const { user } = await openFinance({
      transactions: [makeTransaction({ id: 't1', date: today }), makeTransaction({ id: 't2', date: today, status: 'cancelled', note: 'Bekor' })],
    })
    const journal = screen.getByRole('region', { name: 'Tranzaksiyalar jurnali' })
    await user.selectOptions(within(journal).getByLabelText('Status'), 'cancelled')
    expect(within(journal).getByText('1 ta yozuv', { exact: false })).toBeTruthy()
  })

  it('qarzdorlar ro\'yxati va qatordan "To\'lov qabul qilish" (summa oldindan to\'ldiriladi)', async () => {
    const { user } = await openFinance({
      customers: [makeCustomer({ course: ielts.name, status: 'paid' })],
      transactions: [makeTransaction({ id: 't1', amount: 150_000, date: today })],
    })
    const debts = screen.getByRole('table', { name: 'Qarzdorlar' })
    const row = within(debts).getByRole('button', { name: 'Aziza Karimova' }).closest('tr') as HTMLElement
    const cells = within(row).getAllByRole('cell').map((td) => plain(td.textContent))
    expect(cells.slice(1, 5)).toEqual([ielts.name, '650 000 so\'m', '150 000 so\'m', '500 000 so\'m'])

    await user.click(within(row).getByRole('button', { name: 'Aziza Karimova: to\'lov qabul qilish' }))
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })
    expect(plain((within(dialog).getByLabelText(/Summa/) as HTMLInputElement).value)).toBe('500 000')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect(screen.getByText('Joriy oy uchun qarzdorlik yo\'q.')).toBeTruthy()
  })

  it('kutilayotgan to\'lovni "To\'landi" deb belgilash', async () => {
    const { user } = await openFinance({
      customers: [makeCustomer()],
      transactions: [makeTransaction({ id: 'p1', amount: 250_000, date: today, status: 'pending' })],
    })
    expect(screen.getByRole('heading', { name: 'Kutilayotgan to\'lovlar (1)' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'To\'landi' }))
    expect(storedTx()[0].status).toBe('paid')
    expect(screen.getByRole('heading', { name: 'Kutilayotgan to\'lovlar (0)' })).toBeTruthy()
  })

  it('marketing chiqimida "Manba" maydoni; boshqa kategoriyada manba saqlanmaydi', async () => {
    const { user } = await openFinance({})
    await user.click(screen.getByRole('button', { name: 'Xarajat' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xarajat yozish' })
    expect(within(dialog).queryByLabelText('Manba')).toBeNull()
    await user.type(within(dialog).getByLabelText(/Summa/), '400000')
    await user.selectOptions(within(dialog).getByLabelText('Kategoriya'), 'marketing')
    await user.selectOptions(within(dialog).getByLabelText('Manba'), 'telegram')
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'pending')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect(storedTx()[0]).toMatchObject({ type: 'expense', category: 'marketing', source: 'telegram', status: 'pending', method: 'card' })
  })
})
