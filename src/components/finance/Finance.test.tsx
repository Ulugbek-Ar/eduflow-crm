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

describe('Kutilayotgan to\'lovlar sanasi', () => {
  const inDays = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d
  }
  // Sana maydoni sozlamadagi formatda yoziladi (standart: kk.oo.yyyy)
  const inputDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

  it('"Kutilmoqda" kelajakdagi sana bilan kiritiladi; "To\'langan" uchun kelajak rad etiladi', async () => {
    const { user } = await openFinance({ customers: [makeCustomer()] })
    await user.click(screen.getAllByRole('button', { name: 'To\'lov qabul qilish' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })
    await user.type(within(dialog).getByLabelText(/Summa/), '300000')
    const date = within(dialog).getByLabelText(/^Sana/)
    await user.clear(date)
    await user.type(date, inputDate(inDays(10)))
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect(within(dialog).getByText('Kelajakdagi sana faqat "Kutilmoqda" statusida')).toBeTruthy()

    await user.selectOptions(within(dialog).getByLabelText('Status'), 'pending')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const [saved] = storedTx()
    expect(saved.status).toBe('pending')
    expect(new Date(String(saved.date)).getTime()).toBeGreaterThan(Date.now())
  })

  it('"To\'landi" bosilganda to\'lov sanasi bugun bo\'ladi va joriy oy qarzidan ayiriladi', async () => {
    const [ielts] = createMockCourses()
    const lastMonth = new Date()
    lastMonth.setDate(0)
    const { user } = await openFinance({
      customers: [makeCustomer({ course: ielts.name, status: 'paid', createdAt: today })],
      transactions: [makeTransaction({ id: 'p1', amount: 650_000, date: lastMonth.toISOString(), status: 'pending' })],
    })
    await user.click(screen.getByRole('button', { name: 'To\'landi' }))
    const saved = storedTx()[0]
    expect(saved.status).toBe('paid')
    expect(String(saved.date).slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
    expect(screen.getByText('Joriy oy uchun qarzdorlik yo\'q.')).toBeTruthy()
  })

  it('jadvalda kelajakdagi kutilgan to\'lov "To\'langan" qilinsa, sanasi bugunga tushadi', async () => {
    const { user } = await openFinance({
      transactions: [makeTransaction({ id: 'f1', amount: 100_000, date: inDays(3).toISOString(), status: 'pending' })],
    })
    // Kelajakdagi yozuv "Shu oy" davriga kirishi uchun sana oralig'i tanlanadi
    const journal = screen.getByRole('region', { name: 'Tranzaksiyalar jurnali' })
    await user.type(within(journal).getByLabelText('Gacha'), inputDate(inDays(30)))
    await user.selectOptions(within(journal).getByRole('combobox', { name: /^Status: Kirim/ }), 'paid')
    expect(new Date(String(storedTx()[0].date)).getTime()).toBeLessThanOrEqual(Date.now())
  })
})
