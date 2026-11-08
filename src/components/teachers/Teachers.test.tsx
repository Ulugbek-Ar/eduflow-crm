// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, renderSignedIn } from '../../test/helpers'
import type { Group } from '../../types/group.types'
import type { Teacher } from '../../types/teacher.types'

const [ielts] = createMockCourses()
const stored = <T,>(key: string) => JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
const teacher: Teacher = { id: 'p1', name: 'Nodira Saidova', phone: '', subjects: ['IELTS'], payRule: { type: 'fixed', amount: 4_000_000 }, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
const group: Group = { id: 'g1', name: 'IELTS — kechki', courseId: ielts.id, teacherId: 'p1', room: '101', days: ['mon'], startTime: '18:00', endTime: '19:30', capacity: 12, startDate: '2026-01-01', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }

async function openTeachers(data?: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(data)
  await view.user.click(screen.getByRole('button', { name: 'O\'qituvchilar' }))
  return view
}

describe('O\'qituvchilar va maosh', () => {
  it('o\'qituvchi qo\'shish: maosh qoidasi bilan saqlanadi va jurnalga yoziladi', async () => {
    const { user } = await openTeachers()
    await user.click((await screen.findAllByRole('button', { name: 'O\'qituvchi qo\'shish' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'Yangi o\'qituvchi' })
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Sherzod Aliyev')
    await user.type(within(dialog).getByLabelText('Fanlar'), 'Python, Frontend')
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
    expect(await screen.findByRole('button', { name: 'Sherzod Aliyev' })).toBeTruthy()
    expect(stored<Teacher>('apex:teachers')).toMatchObject([{ name: 'Sherzod Aliyev', subjects: ['Python', 'Frontend'], payRule: { type: 'percent', percent: 40 } }])
    expect(stored<{ action: string }>('apex:audit').some((a) => a.action === 'teacher.create')).toBe(true)
  })

  it('bitta tugma bilan kirish: o\'qituvchi rolidagi xodim va vaqtinchalik parol, yozuvga bog\'lanadi', async () => {
    const { user } = await openTeachers({ teachers: [teacher] })
    await user.click(await screen.findByRole('button', { name: 'Kirish yaratish' }))
    const dialog = await screen.findByRole('dialog', { name: 'O\'qituvchiga kirish yaratish' })
    expect((within(dialog).getByLabelText(/Ism familiya/) as HTMLInputElement).value).toBe('Nodira Saidova')
    await user.type(within(dialog).getByLabelText(/^Login/), 'nodira')
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
    // Parol xeshi (PBKDF2) yuklangan mashinada sekin — kutish uzoqroq
    expect(await screen.findByRole('dialog', { name: 'O\'qituvchiga kirish yaratildi' }, { timeout: 10_000 })).toBeTruthy()
    const users = stored<{ id: string; login: string; role: string; mustChange: boolean }>('apex:users')
    const created = users.find((u) => u.login === 'nodira')
    expect(created).toMatchObject({ role: 'teacher', mustChange: true })
    // Yozuvga bog'lash keyingi render'da saqlanadi — yuklangan mashinada kutib tekshiriladi
    await waitFor(() => expect(stored<Teacher>('apex:teachers')[0].userId).toBe(created?.id))
  })

  it('maosh: oy bo\'yicha hisob va "Maosh to\'lash" — teacherId va period bilan xarajat', async () => {
    const { user } = await openTeachers({ teachers: [teacher], groups: [group], customers: [makeCustomer()] })
    await user.click(screen.getByRole('tab', { name: 'Maosh' }))
    const row = (await screen.findByText('Nodira Saidova', { selector: 'strong' })).closest('tr') as HTMLElement
    expect(within(row).getAllByText(/4 000 000/).length).toBeGreaterThan(0)
    await user.click(within(row).getByRole('button', { name: /: maosh to'lash$/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Maosh to\'lash' })
    await user.click(within(dialog).getByRole('button', { name: 'To\'lash' }))
    const [expense] = stored<{ type: string; category: string; teacherId?: string; period?: string; amount: number }>('apex:transactions')
    expect(expense).toMatchObject({ type: 'expense', category: 'salary', teacherId: 'p1', amount: 4_000_000 })
    expect(expense.period).toMatch(/^\d{4}-\d{2}$/)
    expect(within(row).queryByRole('button', { name: /: maosh to'lash$/ })).toBeNull()
  })
})
