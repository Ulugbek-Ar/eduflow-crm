// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, makeTransaction, renderSignedIn } from '../../test/helpers'
import type { Branch } from '../../types/branch.types'
import type { Enrollment, Group } from '../../types/group.types'

const [ielts] = createMockCourses()
const stored = <T,>(key: string) => JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
const pro = () => localStorage.setItem('apex:subscription', JSON.stringify({ plan: 'pro', status: 'active', enforced: false }))

const branch = (id: string, name: string): Branch => ({ id, name, address: '', phone: '', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' })
const group = (patch: Partial<Group>): Group => ({
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
  ...patch,
})
const enrollment = (patch: Partial<Enrollment>): Enrollment => ({ id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-09-01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z', ...patch })

// Ikki filial: Chilonzor (Aziza, IELTS), Yunusobod (Bobur, Python)
const twoBranches = () => ({
  branches: [branch('b1', 'Chilonzor filiali'), branch('b2', 'Yunusobod filiali')],
  groups: [group({ id: 'g1', branchId: 'b1' }), group({ id: 'g2', name: 'Python — 1-guruh', branchId: 'b2' })],
  customers: [makeCustomer({ status: 'paid', course: ielts.name, branchId: 'b1' }), makeCustomer({ id: 'c2', name: 'Bobur Aliyev', phone: '+998 93 111 22 33', status: 'paid', course: ielts.name, branchId: 'b2' })],
  enrollments: [enrollment({}), enrollment({ id: 'e2', customerId: 'c2', groupId: 'g2' })],
  transactions: [makeTransaction({ id: 't1', amount: 650_000, enrollmentId: 'e1', branchId: 'b1' }), makeTransaction({ id: 't2', customerId: 'c2', customerName: 'Bobur Aliyev', amount: 500_000, enrollmentId: 'e2', branchId: 'b2' })],
})

describe('Filiallar', () => {
  it('birinchi filial — mavjud ma\'lumot unga biriktiriladi; ikkinchisi qo\'shilgach Header\'da tanlov va filtr', async () => {
    pro()
    const { user } = await renderSignedIn({
      groups: [group({})],
      customers: [makeCustomer({ status: 'paid', course: ielts.name })],
      enrollments: [enrollment({})],
      transactions: [makeTransaction({ id: 't1', amount: 650_000, enrollmentId: 'e1' }), makeTransaction({ id: 't2', type: 'expense', category: 'rent', amount: 2_000_000, customerId: undefined, customerName: undefined })],
    })
    expect(screen.queryByRole('combobox', { name: 'Filial' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    const card = await screen.findByRole('region', { name: 'Filiallar' })
    expect(within(card).getByText(/Hozircha filial yo'q/)).toBeTruthy()
    const form = within(card).getByRole('form', { name: 'Yangi filial' })
    await user.click(within(form).getByRole('button', { name: 'Filial qo\'shish' }))
    expect(within(form).getByText('Filial nomini kiriting (2–60 belgi)')).toBeTruthy()

    await user.type(within(form).getByLabelText(/Filial nomi/), 'Chilonzor filiali')
    await user.type(within(form).getByLabelText('Manzil'), 'Chilonzor 9-kvartal')
    expect((within(form).getByRole('checkbox', { name: /Mavjud guruhlar, mijozlar va to'lovlarni/ }) as HTMLInputElement).checked).toBe(true)
    await user.click(within(form).getByRole('button', { name: 'Filial qo\'shish' }))
    const [first] = stored<Branch>('apex:branches')
    expect(first).toMatchObject({ name: 'Chilonzor filiali', address: 'Chilonzor 9-kvartal', status: 'active' })
    expect(stored<Group>('apex:groups').map((g) => g.branchId)).toEqual([first.id])
    expect(stored<{ branchId?: string }>('apex:customers').map((c) => c.branchId)).toEqual([first.id])
    expect(stored<{ branchId?: string }>('apex:transactions').map((t) => t.branchId)).toEqual([first.id, first.id])
    expect(within(card).getByText('1 ta faol guruh · 1 ta mijoz')).toBeTruthy()

    // Takror nom — rad; ikkinchi filial
    await user.type(within(form).getByLabelText(/Filial nomi/), 'chilonzor filiali')
    await user.click(within(form).getByRole('button', { name: 'Filial qo\'shish' }))
    expect(within(form).getByText('"chilonzor filiali" nomli filial bor')).toBeTruthy()
    await user.clear(within(form).getByLabelText(/Filial nomi/))
    await user.type(within(form).getByLabelText(/Filial nomi/), 'Yunusobod filiali')
    await user.click(within(form).getByRole('button', { name: 'Filial qo\'shish' }))
    expect(stored<Branch>('apex:branches')).toHaveLength(2)

    const switcher = screen.getByRole('combobox', { name: 'Filial' }) as HTMLSelectElement
    expect([...switcher.options].map((o) => o.text)).toEqual(['Barcha filiallar', 'Chilonzor filiali', 'Yunusobod filiali'])
    const second = stored<Branch>('apex:branches')[1]
    await user.selectOptions(switcher, second.id)
    await user.click(screen.getByRole('button', { name: 'Guruhlar' }))
    expect(await screen.findByText('Bu filialda hali guruh yo\'q')).toBeTruthy()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '')
    expect(await screen.findByRole('button', { name: 'IELTS — kechki' })).toBeTruthy()
  })

  it('Standart tarifda bitta filial: ikkinchisini qo\'shish tugmasi yopiq', async () => {
    const { user } = await renderSignedIn({ branches: [branch('b1', 'Chilonzor filiali')] })
    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    const card = await screen.findByRole('region', { name: 'Filiallar' })
    expect(within(card).getByText('Tarifingizda 1 ta filial. Bir nechta filial — Pro tarifida.')).toBeTruthy()
    expect((within(card).getByRole('button', { name: 'Filial qo\'shish' }) as HTMLButtonElement).disabled).toBe(true)
    // Bitta filialda Header tanlovi kerak emas, lekin tanlov ro'yxati chiqadi (barchasi / shu filial)
    expect(screen.getByRole('combobox', { name: 'Filial' })).toBeTruthy()
  })

  it('filialga cheklangan administrator: faqat o\'z filiali, Header\'da nomi, Filiallar bo\'limi yo\'q', async () => {
    const { user } = await renderSignedIn(twoBranches(), { branchId: 'b2' })
    expect(screen.queryByRole('combobox', { name: 'Filial' })).toBeNull()
    expect(screen.getByText('Yunusobod filiali', { selector: '.branch-switch-name' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Jadval' }))
    expect(await screen.findByRole('button', { name: 'Bobur Aliyev kartasi' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Aziza Karimova kartasi' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    await screen.findByRole('region', { name: 'Tashkilot' })
    expect(screen.queryByRole('region', { name: 'Filiallar' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Filiallar' })).toBeNull()
  })

  it('to\'lov filiali o\'qish guruhidan olinadi; xarajat — tanlangan filial yoki umumiy', async () => {
    pro()
    const data = twoBranches()
    const { user } = await renderSignedIn({ ...data, transactions: [] })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), 'b1')
    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    // Xarajat: Chilonzor tanlangan — standart shu filial
    await user.click(await screen.findByRole('button', { name: /Xarajat/ }))
    const expense = await screen.findByRole('dialog', { name: 'Xarajat yozish' })
    expect((within(expense).getByLabelText('Filial') as HTMLSelectElement).value).toBe('b1')
    await user.type(within(expense).getByLabelText(/Summa/), '2000000')
    await user.click(within(expense).getByRole('button', { name: 'Saqlash' }))
    expect(stored<{ type: string; branchId?: string }>('apex:transactions')[0]).toMatchObject({ type: 'expense', branchId: 'b1' })

    // Barcha filiallar: Boburning to'lovi (Yunusobod guruhi) — Yunusobod filialiga, tanlovsiz
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '')
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Jadval' }))
    await user.click(await screen.findByRole('button', { name: 'Bobur Aliyev kartasi' }))
    const drawer = await screen.findByRole('dialog', { name: 'Bobur Aliyev' })
    expect(within(drawer).getByText('Yunusobod filiali')).toBeTruthy()
    await user.click(within(drawer).getByRole('button', { name: 'To\'lov' }))
    const payment = await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })
    expect(within(payment).queryByLabelText('Filial')).toBeNull()
    await user.clear(within(payment).getByLabelText(/Summa/))
    await user.type(within(payment).getByLabelText(/Summa/), '500000')
    await user.click(within(payment).getByRole('button', { name: 'Saqlash' }))
    expect(stored<{ customerId?: string; branchId?: string }>('apex:transactions').find((t) => t.customerId === 'c2')).toMatchObject({ branchId: 'b2' })
  })

  it('Analitika: barcha filiallar ko\'rinishida filiallar taqqoslanadi, filial nomi bosilsa — shu filialga o\'tadi', async () => {
    pro()
    const { user } = await renderSignedIn(twoBranches())
    await user.click(screen.getByRole('button', { name: 'Tahlil va hisobotlar' }))
    const card = await screen.findByRole('region', { name: 'Filiallar bo\'yicha' })
    const rows = within(card).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent?.replace(/\s/g, ' '))).toEqual([
      expect.stringContaining('Chilonzor filiali'),
      expect.stringContaining('Yunusobod filiali'),
    ])
    expect(rows[0].textContent?.replace(/\s/g, ' ')).toContain('650 000')
    await user.click(within(card).getByRole('button', { name: 'Yunusobod filiali' }))
    expect((screen.getByRole('combobox', { name: 'Filial' }) as HTMLSelectElement).value).toBe('b2')
    expect(screen.queryByRole('region', { name: 'Filiallar bo\'yicha' })).toBeNull()
  })
})
