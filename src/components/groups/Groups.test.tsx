// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, renderSignedIn } from '../../test/helpers'
import type { Group } from '../../types/group.types'

const [ielts] = createMockCourses()

const group = (patch: Partial<Group> = {}): Group => ({
  id: 'g1',
  name: 'IELTS — kechki',
  courseId: ielts.id,
  room: '101',
  days: ['mon', 'wed', 'fri'],
  startTime: '18:00',
  endTime: '19:30',
  capacity: 2,
  startDate: '2026-09-01',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...patch,
})

const stored = <T,>(key: string) => JSON.parse(localStorage.getItem(key) ?? '[]') as T[]

async function openGroups(data?: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(data)
  await view.user.click(screen.getByRole('button', { name: 'Guruhlar' }))
  await screen.findByRole('region', { name: 'Guruhlar' })
  return view
}

describe('Guruhlar', () => {
  it('ro\'yxat: kurs, kunlar va vaqt, xona, sig\'im; bo\'sh holat', async () => {
    await openGroups({ groups: [group()], enrollments: [{ id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-09-01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' }], customers: [makeCustomer()] })
    const row = screen.getByRole('button', { name: 'IELTS — kechki' }).closest('tr') as HTMLElement
    expect(within(row).getByText('Du/Cho/Ju · 18:00–19:30')).toBeTruthy()
    expect(within(row).getByText('101')).toBeTruthy()
    expect(within(row).getByRole('meter', { name: 'Sig\'im: 1 / 2' })).toBeTruthy()
  })

  it('xona va vaqt boshqa guruh bilan kesishsa — saqlash bloklanadi, aniq xabar chiqadi', async () => {
    const { user } = await openGroups({ groups: [group()] })
    await user.click(screen.getByRole('button', { name: 'Yangi guruh' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi guruh' })
    await user.type(within(dialog).getByLabelText(/Guruh nomi/), 'IELTS — ertalabki')
    await user.type(within(dialog).getByLabelText(/^Xona/), '101')
    const start = within(dialog).getByLabelText(/Boshlanishi/)
    await user.clear(start)
    await user.type(start, '19:00')
    const end = within(dialog).getByLabelText(/Tugashi/)
    await user.clear(end)
    await user.type(end, '20:00')
    await user.click(within(dialog).getByRole('button', { name: 'Guruh ochish' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('"101" xonasi band: "IELTS — kechki" guruhi (Du/Cho/Ju 18:00–19:30)')
    expect(stored('apex:groups')).toHaveLength(1)
    // Vaqtni o'zgartirsak — saqlanadi va guruh kartasi ochiladi
    await user.clear(start)
    await user.type(start, '09:00')
    await user.clear(end)
    await user.type(end, '10:30')
    await user.click(within(dialog).getByRole('button', { name: 'Guruh ochish' }))
    expect(await screen.findByRole('dialog', { name: 'IELTS — ertalabki' })).toBeTruthy()
    expect(stored<Group>('apex:groups').map((g) => g.name)).toEqual(['IELTS — kechki', 'IELTS — ertalabki'])
  })

  it('lid guruhga qo\'shilsa — tasdiqdan so\'ng "To\'lov qildi" va paidAt; enrollment yoziladi', async () => {
    const lead = makeCustomer({ id: 'c7', name: 'Bobur Aliyev', status: 'new', phone: '+998 90 777 77 77' })
    const { user } = await openGroups({ groups: [group()], customers: [lead] })
    await user.click(screen.getByRole('button', { name: 'IELTS — kechki' }))
    const drawer = await screen.findByRole('dialog', { name: 'IELTS — kechki' })
    await user.click(within(drawer).getByLabelText('O\'quvchi qo\'shish'))
    await user.click(await screen.findByRole('option', { name: /Bobur Aliyev/ }))
    await user.click(within(drawer).getByRole('button', { name: 'Qo\'shish' }))
    const confirmDialog = await screen.findByRole('alertdialog', { name: 'Lidni guruhga qo\'shish' })
    await user.click(within(confirmDialog).getByRole('button', { name: 'Qo\'shish' }))
    expect(await within(drawer).findByText('Bobur Aliyev')).toBeTruthy()
    const customers = stored<{ id: string; status: string; paidAt?: string }>('apex:customers')
    expect(customers[0]).toMatchObject({ id: 'c7', status: 'paid' })
    expect(customers[0].paidAt).toBeTruthy()
    expect(stored<{ customerId: string; groupId: string; status: string }>('apex:enrollments')).toMatchObject([{ customerId: 'c7', groupId: 'g1', status: 'active' }])
    const audit = stored<{ action: string }>('apex:audit').map((a) => a.action)
    expect(audit).toContain('enrollment.create')
  })
})
