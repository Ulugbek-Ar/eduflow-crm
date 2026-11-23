// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { makeCustomer, makeTransaction } from '../test/helpers'
import { cloudConfig } from './config'
import { diffById } from './diff'
import {
  attendanceToRow,
  courseToRow,
  customerToRow,
  enrollmentToRow,
  exceptionToRow,
  groupToRow,
  rowToAttendance,
  rowToCourse,
  rowToCustomer,
  rowToEnrollment,
  rowToException,
  rowToGroup,
  rowToTeacher,
  rowToTransaction,
  teacherToRow,
  transactionToRow,
} from './mappers'
import type { AttendanceRecord } from '../types/attendance.types'
import type { Enrollment, Group } from '../types/group.types'
import type { Teacher } from '../types/teacher.types'

describe('bulutli rejim sozlamasi', () => {
  it('kalitlar bo\'lmasa yoki noto\'g\'ri bo\'lsa — lokal rejim', () => {
    expect(cloudConfig({})).toBeNull()
    expect(cloudConfig({ VITE_SUPABASE_URL: 'ftp://x', VITE_SUPABASE_ANON_KEY: 'a'.repeat(40) })).toBeNull()
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: 'short' })).toBeNull()
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: 'a'.repeat(40) })).toEqual({ url: 'https://abc.supabase.co', anonKey: 'a'.repeat(40) })
  })
})

describe('qator <-> model', () => {
  it('mijoz, tranzaksiya va kurs o\'zgarishsiz qaytadi', () => {
    const customer = makeCustomer({ email: 'a@b.uz', paidAt: '2026-10-02T00:00:00.000Z' })
    expect(rowToCustomer(customerToRow(customer, 'org'))).toEqual(customer)
    const bare = makeCustomer()
    expect(rowToCustomer(customerToRow(bare, 'org'))).toEqual(bare)
    const tx = makeTransaction({ source: 'instagram' })
    expect(rowToTransaction(transactionToRow(tx, 'org'))).toEqual(tx)
    const course = { id: 'k1', name: 'IELTS', type: 'course' as const, durationMonths: 6, monthlyPrice: 650_000, status: 'active' as const, createdAt: '2026-01-01T00:00:00.000Z' }
    expect(rowToCourse(courseToRow(course, 'org'))).toEqual(course)
    expect(customerToRow(bare, 'org')).toMatchObject({ organization_id: 'org', email: null, paid_at: null })
  })

  it('v11: o\'qituvchi, guruh, o\'qish, davomat va bekor qilingan dars o\'zgarishsiz qaytadi', () => {
    const teacher: Teacher = { id: 'p1', name: 'Nodira Saidova', phone: '+998 90 311 22 44', subjects: ['IELTS'], payRule: { type: 'percent', percent: 40 }, userId: 'u5', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
    expect(rowToTeacher(teacherToRow(teacher, 'org'))).toEqual(teacher)
    const group: Group = { id: 'g1', name: 'IELTS — kechki', courseId: 'k1', teacherId: 'p1', room: '101', days: ['mon', 'wed', 'fri'], startTime: '18:00', endTime: '19:30', capacity: 15, startDate: '2026-09-01', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
    expect(rowToGroup(groupToRow(group, 'org'))).toEqual(group)
    // Postgres "time" va "date" qaytaradigan ko'rinish
    expect(rowToGroup({ ...groupToRow(group, 'org'), start_time: '18:00:00', end_time: '19:30:00', start_date: '2026-09-01' })).toEqual(group)
    const enrollment: Enrollment = { id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-09-02', endDate: '2027-02-28', discountPercent: 10, priceOverride: 500_000, status: 'paused', pausedFrom: '2026-11-01', pausedTo: '2026-11-30', createdAt: '2026-09-02T10:00:00.000Z' }
    expect(rowToEnrollment(enrollmentToRow(enrollment, 'org'))).toEqual(enrollment)
    expect(rowToEnrollment({ ...enrollmentToRow(enrollment, 'org'), discount_percent: '10.00', price_override: '500000' })).toEqual(enrollment)
    const record: AttendanceRecord = { id: 'd1', groupId: 'g1', customerId: 'c1', date: '2026-11-06', status: 'late', note: '10 daqiqa', markedBy: 'Nodira', updatedAt: '2026-11-06T19:40:00.000Z' }
    expect(rowToAttendance(attendanceToRow(record, 'org'))).toEqual(record)
    const exception = { id: 'x1', groupId: 'g1', date: '2026-10-01', reason: 'Bayram' }
    expect(rowToException(exceptionToRow(exception, 'org'))).toEqual(exception)
    const tx = makeTransaction({ enrollmentId: 'e1', period: '2026-11' })
    expect(rowToTransaction(transactionToRow(tx, 'org'))).toEqual(tx)
    expect(transactionToRow(makeTransaction(), 'org')).toMatchObject({ enrollment_id: null, teacher_id: null, period: null })
  })

  it('Supabase bigint (matn) summasi songa aylanadi', () => {
    expect(rowToTransaction({ ...transactionToRow(makeTransaction(), 'o'), amount: '650000' }).amount).toBe(650_000)
  })
})

describe('farq', () => {
  it('faqat o\'zgargan va olib tashlanganlar', () => {
    const a = makeCustomer({ id: 'a' })
    const b = makeCustomer({ id: 'b' })
    const c = makeCustomer({ id: 'c' })
    const changes = diffById([a, b], [{ ...a, name: 'Yangi' }, c])
    expect(changes.upserts.map((x) => x.id)).toEqual(['a', 'c'])
    expect(changes.removedIds).toEqual(['b'])
    expect(diffById([a], [{ ...a }])).toEqual({ upserts: [], removedIds: [] })
  })
})
