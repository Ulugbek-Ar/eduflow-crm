// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { renderSignedIn } from '../../test/helpers'
import type { Group } from '../../types/group.types'

const [ielts, frontend] = createMockCourses()
const group = (patch: Partial<Group>): Group => ({
  id: 'g1',
  name: 'IELTS — kechki',
  courseId: ielts.id,
  room: '101',
  days: ['mon', 'wed', 'fri'],
  startTime: '18:00',
  endTime: '19:30',
  capacity: 12,
  startDate: '2026-01-01',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...patch,
})

describe('Dars jadvali', () => {
  it('haftalik setka: bloklar kurs rangida, ziddiyat qizil, blok bosilsa guruh kartasi ochiladi', async () => {
    const { user } = await renderSignedIn({
      groups: [group({}), group({ id: 'g2', name: 'Frontend — kechki', courseId: frontend.id, days: ['mon'], startTime: '19:00', endTime: '20:30' })],
    })
    await user.click(screen.getByRole('button', { name: 'Dars jadvali' }))
    const region = await screen.findByRole('region', { name: 'Dars jadvali' })
    expect(within(region).getByText(/2 ta guruhda ziddiyat/)).toBeTruthy()
    const monday = within(region).getByRole('list', { name: /^Du / })
    const blocks = within(monday).getAllByRole('button')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].className).toContain('course-c1')
    expect(blocks[0].className).toContain('is-conflict')
    expect(blocks[1].className).toContain('course-c2')
    // Chorshanbada faqat IELTS
    expect(within(within(region).getByRole('list', { name: /^Cho / })).getAllByRole('button')).toHaveLength(1)
    await user.click(blocks[0])
    expect(await screen.findByRole('dialog', { name: 'IELTS — kechki' })).toBeTruthy()
  })

  it('"Xonalar bo\'yicha": ustunlar — xonalar', async () => {
    const { user } = await renderSignedIn({ groups: [group({}), group({ id: 'g2', name: 'Python', room: '102', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], startTime: '10:00', endTime: '11:00' })] })
    await user.click(screen.getByRole('button', { name: 'Dars jadvali' }))
    await user.click(await screen.findByRole('button', { name: 'Xonalar bo\'yicha' }))
    expect(screen.getByRole('list', { name: '102' })).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Hafta kuni' })).toBeTruthy()
  })
})
