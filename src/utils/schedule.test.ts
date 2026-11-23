import { describe, expect, it } from 'vitest'
import type { Group } from '../types/group.types'
import { courseColor, placeBlocks, timeSlots, weekDates } from './schedule'

const group = (id: string, startTime: string, endTime: string): Group => ({ id, name: id, courseId: 'k1', room: '', days: ['mon'], startTime, endTime, capacity: 10, startDate: '2026-01-01', status: 'active', createdAt: '' })

describe('dars jadvali', () => {
  it('08:00–21:00, 30 daqiqalik qatorlar', () => {
    const slots = timeSlots()
    expect(slots[0]).toBe('08:00')
    expect(slots.at(-1)).toBe('20:30')
    expect(slots).toHaveLength(26)
  })

  it('bloklar vaqtiga qarab joylashadi; kesishganlari yonma-yon', () => {
    const placed = placeBlocks([group('a', '09:00', '10:30'), group('b', '10:00', '11:00'), group('c', '14:00', '15:30'), group('d', '10:30', '12:00')])
    const byId = Object.fromEntries(placed.map((p) => [p.group.id, p]))
    expect(byId.a).toMatchObject({ top: 2, height: 3, lane: 0, lanes: 2 })
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 })
    // a 10:30 da tugadi — d o'sha bo'sh joyga
    expect(byId.d).toMatchObject({ lane: 0, lanes: 2 })
    expect(byId.c).toMatchObject({ top: 12, lanes: 1 })
  })

  it('oraliqdan tashqari vaqt qisiladi', () => {
    const [early] = placeBlocks([group('e', '07:00', '08:30')])
    expect(early.top).toBe(0)
    expect(early.height).toBe(1)
  })

  it('joriy hafta sanalari va kurs rangi', () => {
    expect(weekDates('2026-11-07')).toMatchObject({ mon: '2026-11-02', sat: '2026-11-07', sun: '2026-11-08' })
    expect(courseColor('k2', ['k1', 'k2'])).toBe('course-c2')
    expect(courseColor('k9', ['k1'])).toBe('course-c1')
    expect(courseColor('k9', Array.from({ length: 9 }, (_, i) => `k${i + 1}`))).toBe('course-c1')
  })
})
