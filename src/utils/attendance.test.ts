import { describe, expect, it } from 'vitest'
import type { AttendanceRecord } from '../types/attendance.types'
import type { Enrollment, Group } from '../types/group.types'
import { absentStreaks, attendanceRate, lessonDates, nextStatus, teacherAttendanceRate, todayLessons, trailingAbsences, unmarkedLessons } from './attendance'

const group: Group = { id: 'g1', name: 'IELTS', courseId: 'k1', teacherId: 'p1', room: '', days: ['mon', 'wed', 'fri'], startTime: '09:00', endTime: '10:30', capacity: 12, startDate: '2026-11-04', status: 'active', createdAt: '' }
const rec = (date: string, status: AttendanceRecord['status'], customerId = 'c1'): AttendanceRecord => ({ id: `${customerId}-${date}`, groupId: 'g1', customerId, date, status, updatedAt: `${date}T12:00:00.000Z` })
const enrollment: Enrollment = { id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-11-01', status: 'active', createdAt: '' }

describe('davomat', () => {
  it('dars sanalari: guruh kunlari, boshlanishidan bugungacha, bekor qilinganlar chiqariladi', () => {
    // Noyabr 2026: 4-chorshanba (boshlanish), 6-juma, 9-dushanba, 11-chorshanba (bekor), 13-juma
    expect(lessonDates(group, '2026-11-01', '2026-11-30', [{ groupId: 'g1', date: '2026-11-11' }], '2026-11-13')).toEqual(['2026-11-04', '2026-11-06', '2026-11-09', '2026-11-13'])
    expect(lessonDates({ ...group, endDate: '2026-11-06' }, '2026-11-01', '2026-11-30', [], '2026-11-30')).toEqual(['2026-11-04', '2026-11-06'])
  })

  it('foiz: (keldi + kechikdi) / (keldi + kechikdi + kelmadi); sababli hisobga kirmaydi', () => {
    expect(attendanceRate([rec('2026-11-04', 'present'), rec('2026-11-06', 'late'), rec('2026-11-09', 'absent'), rec('2026-11-11', 'excused')])).toBeCloseTo(66.67, 1)
    expect(attendanceRate([])).toBeNull()
    expect(attendanceRate([rec('2026-11-04', 'excused')])).toBeNull()
  })

  it('ketma-ket kelmaganlar: oxirgi belgilangan darslardan', () => {
    const records = [rec('2026-11-02', 'present'), rec('2026-11-04', 'absent'), rec('2026-11-06', 'absent'), rec('2026-11-09', 'absent')]
    expect(trailingAbsences(records, 'c1', 'g1')).toBe(3)
    expect(absentStreaks([enrollment], records, '2026-11-09')).toEqual([{ customerId: 'c1', groupId: 'g1', count: 3 }])
    expect(absentStreaks([enrollment], [...records, rec('2026-11-11', 'late')], '2026-11-11')).toEqual([])
  })

  it('bugungi darslar va belgilanmagan tugagan darslar', () => {
    const slots = todayLessons([group], [enrollment], [], [], '2026-11-09', 11 * 60)
    expect(slots).toMatchObject([{ ended: true, students: 1, marked: 0 }])
    expect(unmarkedLessons(slots)).toHaveLength(1)
    expect(unmarkedLessons(todayLessons([group], [enrollment], [rec('2026-11-09', 'present')], [], '2026-11-09', 11 * 60))).toHaveLength(0)
    // Dars hali tugamagan
    expect(unmarkedLessons(todayLessons([group], [enrollment], [], [], '2026-11-09', 9 * 60))).toHaveLength(0)
    // Bekor qilingan dars ro'yxatda yo'q
    expect(todayLessons([group], [enrollment], [], [{ id: 'x', groupId: 'g1', date: '2026-11-09', reason: '' }], '2026-11-09', 600)).toEqual([])
  })

  it('o\'qituvchi bo\'yicha foiz va katak holati ketma-ketligi', () => {
    expect(teacherAttendanceRate('p1', [group], [rec('2026-11-04', 'present'), rec('2026-11-06', 'absent')])).toBe(50)
    expect(teacherAttendanceRate('p2', [group], [rec('2026-11-04', 'present')])).toBeNull()
    expect([undefined, 'present', 'absent', 'late', 'excused'].map((s) => nextStatus(s as never))).toEqual(['present', 'absent', 'late', 'excused', 'present'])
  })
})
