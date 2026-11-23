import { describe, expect, it } from 'vitest'
import type { Enrollment, Group, GroupInput } from '../types/group.types'
import { allConflicts, conflictMessage, datesOverlap, findConflicts, timesOverlap, validateGroup } from './groupForm'
import { activeStudentsOn, daysLabel, enrollmentActiveOn, enrollmentMonthlyFee, hasLessonOn, occupiesSeat, seatsTaken, weekdayOf } from './groups'

const group = (patch: Partial<Group> = {}): Group => ({
  id: 'g1',
  name: 'IELTS — kechki',
  courseId: 'k1',
  teacherId: 'p1',
  room: '101',
  days: ['mon', 'wed', 'fri'],
  startTime: '18:00',
  endTime: '19:30',
  capacity: 15,
  startDate: '2026-09-01',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...patch,
})

const input = (patch: Partial<GroupInput> = {}): GroupInput => {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = group({ id: 'new', name: 'Python', room: '102', teacherId: 'p2', ...patch })
  return rest
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

describe('vaqt va sana kesishuvi', () => {
  it('19:30 da tugagan va 19:30 da boshlangan darslar kesishmaydi', () => {
    expect(timesOverlap('18:00', '19:30', '19:30', '21:00')).toBe(false)
    expect(timesOverlap('18:00', '19:30', '19:00', '20:00')).toBe(true)
    expect(timesOverlap('09:00', '10:30', '08:00', '12:00')).toBe(true)
  })

  it('tugash sanasi bo\'lmasa — cheksiz', () => {
    expect(datesOverlap({ startDate: '2026-09-01' }, { startDate: '2027-01-01' })).toBe(true)
    expect(datesOverlap({ startDate: '2026-09-01', endDate: '2026-12-31' }, { startDate: '2027-01-01' })).toBe(false)
  })
})

describe('guruh formasi', () => {
  it('to\'g\'ri guruh — xatosiz', () => {
    expect(validateGroup(input(), [group()])).toEqual({})
  })

  it('tugash > boshlanish, kamida bitta kun, sig\'im ≥ 1, nom takrorlanmaydi', () => {
    expect(validateGroup(input({ endTime: '18:00', startTime: '18:00' }), []).endTime).toBeDefined()
    expect(validateGroup(input({ days: [] }), []).days).toBeDefined()
    expect(validateGroup(input({ capacity: 0 }), []).capacity).toBeDefined()
    expect(validateGroup(input({ capacity: 2.5 }), []).capacity).toBeDefined()
    expect(validateGroup(input({ name: ' ielts — KECHKI ' }), [group()]).name).toBe('Bu nomdagi guruh bor')
    expect(validateGroup(input({ endDate: '2026-08-01' }), []).endDate).toBeDefined()
    expect(validateGroup(input({ courseId: '' }), []).courseId).toBeDefined()
  })

  it('bir xil xona, kesishgan kun va vaqt — saqlash bloklanadi, xabarda guruh va vaqt aniq aytiladi', () => {
    const errors = validateGroup(input({ room: '101', days: ['wed'], startTime: '19:00', endTime: '20:30' }), [group()])
    expect(errors.conflict).toBe('Ziddiyat: "101" xonasi band: "IELTS — kechki" guruhi (Cho 18:00–19:30). Vaqt, kun yoki xonani o\'zgartiring.')
  })

  it('bir xil o\'qituvchi — boshqa xonada ham ziddiyat; kunlar kesishmasa yoki guruh arxivda — yo\'q', () => {
    const teachers = [{ id: 'p1', name: 'Nodira Saidova', phone: '', subjects: [], payRule: { type: 'fixed' as const, amount: 0 }, status: 'active' as const, createdAt: '' }]
    const [conflict] = findConflicts(input({ teacherId: 'p1', days: ['mon', 'fri'] }), [group()])
    expect(conflict).toMatchObject({ kind: 'teacher', days: ['mon', 'fri'] })
    expect(conflictMessage(conflict, teachers)).toBe('Nodira Saidova shu vaqtda "IELTS — kechki" guruhida dars beradi (Du/Ju 18:00–19:30)')
    expect(findConflicts(input({ teacherId: 'p1', days: ['tue', 'thu'] }), [group()])).toEqual([])
    expect(findConflicts(input({ teacherId: 'p1' }), [group({ status: 'archived' })])).toEqual([])
    // Tahrirlashda o'zi bilan ziddiyat yo'q
    expect(findConflicts(group(), [group()], 'g1')).toEqual([])
    // Xonasi yo'q (bo'sh) guruhlar xona bo'yicha ziddiyat bermaydi
    expect(findConflicts(input({ room: '', teacherId: undefined }), [group({ room: '' })])).toEqual([])
  })

  it('mavjud ziddiyatlar ro\'yxati (masalan, importdan)', () => {
    const map = allConflicts([group(), group({ id: 'g2', name: 'Boshqa', teacherId: 'p2' }), group({ id: 'g3', name: 'Ertalab', startTime: '09:00', endTime: '10:00' })])
    expect([...map.keys()].sort()).toEqual(['g1', 'g2'])
  })
})

describe('o\'qish (enrollment)', () => {
  it('faol: boshlangan, tugamagan, pauzada emas', () => {
    expect(enrollmentActiveOn(enrollment(), '2026-11-07')).toBe(true)
    expect(enrollmentActiveOn(enrollment({ startDate: '2026-12-01' }), '2026-11-07')).toBe(false)
    expect(enrollmentActiveOn(enrollment({ status: 'left', endDate: '2026-10-31' }), '2026-11-07')).toBe(false)
    expect(enrollmentActiveOn(enrollment({ status: 'finished', endDate: '2026-11-30' }), '2026-11-07')).toBe(true)
    expect(enrollmentActiveOn(enrollment({ status: 'paused', pausedFrom: '2026-11-01', pausedTo: '2026-11-30' }), '2026-11-07')).toBe(false)
    expect(enrollmentActiveOn(enrollment({ status: 'paused', pausedFrom: '2026-11-01', pausedTo: '2026-11-30' }), '2026-12-01')).toBe(true)
  })

  it('sig\'im: faol va pauzadagilar joy egallaydi', () => {
    const list = [enrollment(), enrollment({ id: 'e2', status: 'paused' }), enrollment({ id: 'e3', status: 'left', endDate: '2026-10-01' }), enrollment({ id: 'e4', groupId: 'g2', customerId: 'c4' })]
    expect(seatsTaken('g1', list, '2026-11-07')).toBe(2)
    expect(occupiesSeat(enrollment({ startDate: '2026-12-01' }), '2026-11-07')).toBe(true)
    expect(activeStudentsOn(list, '2026-11-07')).toBe(2)
  })

  it('oylik summa: (individual narx ?? kurs narxi) × (1 − chegirma%)', () => {
    expect(enrollmentMonthlyFee({}, { monthlyPrice: 650_000 })).toBe(650_000)
    expect(enrollmentMonthlyFee({ discountPercent: 10 }, { monthlyPrice: 650_000 })).toBe(585_000)
    expect(enrollmentMonthlyFee({ priceOverride: 500_000, discountPercent: 20 }, { monthlyPrice: 650_000 })).toBe(400_000)
  })

  it('hafta kuni va bugungi dars', () => {
    expect(weekdayOf(new Date(2026, 10, 9))).toBe('mon')
    expect(weekdayOf(new Date(2026, 10, 8))).toBe('sun')
    expect(daysLabel(['fri', 'mon', 'wed'])).toBe('Du/Cho/Ju')
    expect(hasLessonOn(group(), '2026-11-09')).toBe(true)
    expect(hasLessonOn(group(), '2026-11-10')).toBe(false)
    expect(hasLessonOn(group({ status: 'archived' }), '2026-11-09')).toBe(false)
  })
})
