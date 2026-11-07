// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, makeTransaction, plain, renderSignedIn } from '../../test/helpers'
import type { Enrollment, Group } from '../../types/group.types'

const [ielts] = createMockCourses()

const group: Group = {
  id: 'g1',
  name: 'IELTS — kechki',
  courseId: ielts.id,
  room: '101',
  days: ['mon', 'wed', 'fri'],
  startTime: '18:00',
  endTime: '19:30',
  capacity: 12,
  startDate: '2026-09-01',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
}

const enrollment = (patch: Partial<Enrollment> = {}): Enrollment => ({
  id: 'e1',
  customerId: 'c1',
  groupId: 'g1',
  startDate: '2026-09-01',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...patch,
})

const storedTx = () => JSON.parse(localStorage.getItem('apex:transactions') ?? '[]') as Array<Record<string, unknown>>

// Bugun — 20-noyabr: Aziza uchun sentabr, oktabr va noyabr (muddat — 10-sana) to'lanishi kerak, Bobur uchun — noyabr
const data = (transactions = [makeTransaction({ id: 't0', amount: ielts.monthlyPrice, date: '2026-09-03T10:00:00.000Z', period: '2026-09' })]) => ({
  customers: [makeCustomer({ course: ielts.name }), makeCustomer({ id: 'c2', name: 'Bobur Aliyev', phone: '+998 93 555 44 33', course: ielts.name })],
  groups: [group],
  enrollments: [enrollment(), enrollment({ id: 'e2', customerId: 'c2', startDate: '2026-11-01', createdAt: '2026-11-01T00:00:00.000Z' })],
  transactions,
})

async function openFinance(seed: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(seed)
  await view.user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
  await screen.findByRole('region', { name: 'Tranzaksiyalar jurnali' })
  return view
}

const debtRow = (name: string) => within(screen.getByRole('table', { name: 'Qarzdorlar' })).getByRole('button', { name }).closest('tr') as HTMLElement

describe('Qarzdorlik (o\'qish asosida) va eslatmalar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 10))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('qarz o\'qish boshidan; to\'lov formasi guruh, oy va qoldiq bilan to\'ladi; chekda guruh va oy', async () => {
    const { user } = await openFinance(data())
    const cells = within(debtRow('Aziza Karimova')).getAllByRole('cell').map((td) => plain(td.textContent))
    expect(cells.slice(2, 5)).toEqual(['IELTS — kechki', '650 000 so\'m', '1 300 000 so\'m'])
    expect(plain(within(debtRow('Bobur Aliyev')).getAllByRole('cell')[4].textContent)).toBe('650 000 so\'m')

    await user.click(within(debtRow('Aziza Karimova')).getByRole('button', { name: 'Aziza Karimova: to\'lov qabul qilish' }))
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })
    const amount = within(dialog).getByLabelText(/Summa/) as HTMLInputElement
    expect((within(dialog).getByLabelText('Guruh') as HTMLSelectElement).value).toBe('e1')
    expect((within(dialog).getByLabelText('Qaysi oy uchun') as HTMLSelectElement).value).toBe('2026-11')
    expect(plain(amount.value)).toBe('1 300 000')
    // Oktabr oxirigacha: sentabr + oktabr − to'langan
    await user.selectOptions(within(dialog).getByLabelText('Qaysi oy uchun'), '2026-10')
    expect(plain(amount.value)).toBe('650 000')
    await user.selectOptions(within(dialog).getByLabelText('Qaysi oy uchun'), '2026-11')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    expect(storedTx()[0]).toMatchObject({ amount: 1_300_000, customerId: 'c1', enrollmentId: 'e1', period: '2026-11' })
    expect(within(screen.getByRole('table', { name: 'Qarzdorlar' })).queryByRole('button', { name: 'Aziza Karimova' })).toBeNull()

    await user.click(within(screen.getByRole('region', { name: 'Bildirishnomalar' })).getByRole('button', { name: 'Chek' }))
    const receipt = await screen.findByRole('dialog', { name: 'To\'lov cheki' })
    expect(within(receipt).getByText('IELTS — kechki')).toBeTruthy()
    expect(within(receipt).getByText('11.2026')).toBeTruthy()
  })

  it('belgilanganlarga eslatma: bitta matn, til almashadi, nusxa jurnalga yoziladi — "Oxirgi eslatma: bugun"', async () => {
    const { user } = await openFinance(data([]))
    await user.click(screen.getByRole('checkbox', { name: 'Hammasini belgilash' }))
    await user.click(screen.getByRole('button', { name: 'Tanlanganlarga eslatma (2)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Eslatma: 2 ta qarzdor' })
    const text = () => plain((within(dialog).getByLabelText('Xabar matni') as HTMLTextAreaElement).value)
    expect(text()).toContain('Aziza Karimova (+998 90 123 45 67):')
    expect(text()).toContain('Assalomu alaykum, Bobur Aliyev!')
    expect(text()).toContain('IELTS — kechki')
    expect(text()).toContain('noyabr oyi to\'lovi — 1 950 000 so\'m')
    // Ko'p qatorli eslatmada Telegram/SMS tugmalari yo'q (har biri o'z chatiga)
    expect(within(dialog).queryByRole('link', { name: 'SMS' })).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Русский' }))
    expect(text()).toContain('Здравствуйте, Aziza Karimova!')
    expect(text()).toContain('ноябрь')

    await user.click(within(dialog).getByRole('button', { name: 'Nusxa olish' }))
    expect(await within(dialog).findByText('Nusxa olindi')).toBeTruthy()
    expect(await navigator.clipboard.readText()).toContain('Здравствуйте, Bobur Aliyev!')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()

    expect(within(debtRow('Aziza Karimova')).getByText(/Oxirgi eslatma: bugun/)).toBeTruthy()
    expect(within(debtRow('Bobur Aliyev')).getByText(/Oxirgi eslatma: bugun/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tanlanganlarga eslatma/ })).toBeNull()
  })

  it('bitta qarzdorga eslatma: Telegram, SMS va qo\'ng\'iroq havolalari', async () => {
    const { user } = await openFinance(data([]))
    await user.click(within(debtRow('Bobur Aliyev')).getByRole('button', { name: 'Bobur Aliyev: eslatma' }))
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov eslatmasi: Bobur Aliyev' })
    const sms = within(dialog).getByRole('link', { name: 'SMS' }).getAttribute('href') ?? ''
    expect(sms.startsWith('sms:+998935554433?body=')).toBe(true)
    expect(plain(decodeURIComponent(sms))).toContain('650 000 so\'m')
    expect(within(dialog).getByRole('link', { name: 'Telegram' }).getAttribute('href')).toMatch(/^https:\/\/t\.me\/share\/url\?/)
    expect(within(dialog).getByRole('link', { name: 'Qo\'ng\'iroq' }).getAttribute('href')).toBe('tel:+998935554433')
  })
})
