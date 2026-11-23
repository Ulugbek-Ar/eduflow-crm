// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, makeTransaction, plain, renderSignedIn } from '../../test/helpers'

const stored = () => JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<{ status: string; paidAt?: string }>

async function openDetail(data: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(data)
  await view.user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
  const jadval = await screen.findByRole('button', { name: 'Jadval' })
  await view.user.click(jadval)
  await view.user.click(await screen.findByRole('button', { name: 'Aziza Karimova kartasi' }))
  return { ...view, drawer: await screen.findByRole('dialog', { name: 'Aziza Karimova' }) }
}

describe('Mijoz kartasi: bosqich va o\'qish muddati', () => {
  it('bosqich kartaning o\'zida o\'zgaradi; "To\'lov qildi" ga o\'tilganda sana yoziladi, chiqilganda o\'chadi', async () => {
    const { user, drawer } = await openDetail({ customers: [makeCustomer({ status: 'thinking' })] })
    await user.selectOptions(within(drawer).getByLabelText('Bosqichni o\'zgartirish'), 'paid')
    expect(stored()[0].status).toBe('paid')
    expect(stored()[0].paidAt?.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
    expect(within(drawer).getByText('To\'lov qildi', { selector: 'dt' })).toBeTruthy()
    const [ielts] = createMockCourses()
    expect(within(drawer).getByText(`1-oy / ${ielts.durationMonths}`)).toBeTruthy()

    await user.selectOptions(within(drawer).getByLabelText('Bosqichni o\'zgartirish'), 'cancelled')
    expect(stored()[0]).not.toHaveProperty('paidAt')
  })

  it('kurs muddati tugagan bo\'lsa "Tugagan" va qarz yo\'q', async () => {
    const longAgo = new Date()
    longAgo.setMonth(longAgo.getMonth() - 12)
    const { drawer } = await openDetail({ customers: [makeCustomer({ status: 'paid', paidAt: longAgo.toISOString() })] })
    expect(within(drawer).getByText('Tugagan (6 oy)')).toBeTruthy()
    expect(within(drawer).queryByText(/Qarz/)).toBeNull()
  })
})

describe('Mijoz kartasi: guruh bo\'yicha qarz va oylar jadvali', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('guruhdagi qarz, 12 oy jadvali (muddati kelmagan oy belgilanadi) va "To\'lov" — qarzli oy bilan', async () => {
    // 7-noyabr: sentabr va oktabr muddati o'tgan, noyabr (10-sana) — hali emas
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 7, 10))
    const [ielts] = createMockCourses()
    const { user, drawer } = await openDetail({
      customers: [makeCustomer({ course: ielts.name })],
      groups: [{ id: 'g1', name: 'IELTS — kechki', courseId: ielts.id, room: '', days: ['mon'], startTime: '18:00', endTime: '19:30', capacity: 12, startDate: '2026-09-01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' }],
      enrollments: [{ id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-09-01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' }],
      transactions: [makeTransaction({ id: 't0', amount: ielts.monthlyPrice, date: '2026-09-02T10:00:00.000Z', enrollmentId: 'e1', period: '2026-09' })],
    })
    const group = within(drawer).getByRole('button', { name: 'IELTS — kechki' }).closest('li') as HTMLElement
    expect(plain(group.textContent)).toContain('Qarz: 650 000 so\'m')
    expect(plain(within(drawer).getByText(/O'qish boshidan:/).textContent)).toBe('O\'qish boshidan: kutilgan 1 300 000 so\'m, to\'langan 650 000 so\'m')

    const table = within(drawer).getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1).map((r) => plain(r.textContent))
    expect(rows).toEqual(['09.2026650 000650 0000', '10.2026650 0000-650 000', '11.2026 *650 0000-1 300 000'])
    expect(within(drawer).getByText(/to'lov muddati hali kelmagan, qarzga kirmaydi/)).toBeTruthy()

    await user.click(within(drawer).getByRole('button', { name: 'To\'lov' }))
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })
    expect((within(dialog).getByLabelText('Qaysi oy uchun') as HTMLSelectElement).value).toBe('2026-10')
    expect(plain((within(dialog).getByLabelText(/Summa/) as HTMLInputElement).value)).toBe('650 000')
  })
})
