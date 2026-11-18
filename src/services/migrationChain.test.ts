// @vitest-environment jsdom
// Birlashtirishdan keyingi sxema zanjiri: v10 → v11 → v12 (filiallar). 1.1.x tuzatishlari branch'ida yaratilgan
// zaxiralar (v11, davomatda eski "kechikdi"/"sababli" holatlari) va 1.2.0 zaxiralari (v12) ochiladi
import { afterEach, describe, expect, it } from 'vitest'
import { attendanceRate, simpleStatus } from '../utils/attendance'
import { makeCustomer, makeTransaction } from '../test/helpers'
import { createBackup, loadData, parseBackup, readPreMigrationBackup, SCHEMA_VERSION, STORAGE_KEYS } from './storage.service'

afterEach(() => localStorage.clear())

const course = { id: 'k1', name: 'IELTS', type: 'course', durationMonths: 6, monthlyPrice: 650_000, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
const group = {
  id: 'g1', name: 'IELTS — kechki', courseId: 'k1', room: '101', days: ['mon', 'wed'], startTime: '18:00', endTime: '19:30',
  capacity: 12, startDate: '2026-09-01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z',
}
const enrollment = { id: 'e1', groupId: 'g1', customerId: 'c1', startDate: '2026-09-01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' }
const att = (id: string, date: string, status: string) => ({ id, groupId: 'g1', customerId: 'c1', date, status, updatedAt: `${date}T19:00:00.000Z` })

// 1.1.x (v11) zaxirasi: filiallar yo'q, davomatda 4 xil holat
const v11Backup = {
  app: 'eduflow-crm',
  version: 11,
  exportedAt: '2026-11-12T10:00:00.000Z',
  customers: [makeCustomer({ id: 'c1', name: 'Aziza Karimova', status: 'paid', course: 'IELTS' })],
  transactions: [makeTransaction({ id: 't1', customerId: 'c1', amount: 650_000 })],
  courses: [course],
  settings: {},
  teachers: [],
  groups: [group],
  enrollments: [enrollment],
  attendance: [att('a1', '2026-11-02', 'present'), att('a2', '2026-11-04', 'late'), att('a3', '2026-11-09', 'absent'), att('a4', '2026-11-11', 'excused')],
  lessonExceptions: [],
}

describe('sxema zanjiri v10 → v11 → v12 (birlashtirishdan keyin)', () => {
  it('joriy versiya — 12 (filiallar)', () => {
    expect(SCHEMA_VERSION).toBe(12)
  })

  it('1.1.x (v11) JSON zaxirasi ochiladi: yozuvlar saqlanadi, filiallar bo\'sh, davomat holatlari o\'zgarmaydi', () => {
    const parsed = parseBackup(JSON.stringify(v11Backup))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.dropped).toBe(0)
    expect(parsed.data.customers.map((c) => c.id)).toEqual(['c1'])
    expect(parsed.data.groups.map((g) => g.id)).toEqual(['g1'])
    expect(parsed.data.enrollments.map((e) => e.id)).toEqual(['e1'])
    expect(parsed.data.branches).toEqual([])
    // Saqlangan holat o'zgarmaydi (bulut va eski zaxiralar bilan moslik), ko'rinishi — ikki holat
    expect(parsed.data.attendance.map((a) => a.status)).toEqual(['present', 'late', 'absent', 'excused'])
    expect(parsed.data.attendance.map((a) => simpleStatus(a.status))).toEqual(['present', 'present', 'absent', 'absent'])
    expect(attendanceRate(parsed.data.attendance)).toBe(50)
  })

  it('v11 brauzer ma\'lumoti v12 ga ko\'chadi va qayta saqlanadi; yangi zaxira v12', () => {
    const { app: _app, version: _version, exportedAt: _at, ...lists } = v11Backup
    for (const [key, value] of Object.entries(lists)) localStorage.setItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS], JSON.stringify(value))
    localStorage.setItem(STORAGE_KEYS.version, '11')
    localStorage.setItem(STORAGE_KEYS.seeded, 'true')
    const { data, saveError } = loadData()
    expect(saveError).toBeUndefined()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.version) ?? '0')).toBe(12)
    expect(data.attendance).toHaveLength(4)
    expect(data.branches).toEqual([])
    // v11 dan v12 ga o'tishda "v11 dan oldingi" nusxa yaratilmaydi (u faqat v10 → v11 uchun)
    expect(readPreMigrationBackup()).toBeNull()
    const backup = createBackup(data)
    expect(backup.version).toBe(12)
    const again = parseBackup(JSON.stringify(backup))
    expect(again.ok && again.data.attendance.length).toBe(4)
  })

  it('1.2.0 (v12) zaxirasi filiallari bilan ochiladi', () => {
    const branch = { id: 'f1', name: 'Chilonzor', address: '', phone: '', status: 'active', createdAt: '2026-11-08T00:00:00.000Z' }
    const v12 = { ...v11Backup, version: 12, branches: [branch], groups: [{ ...group, branchId: 'f1' }] }
    const parsed = parseBackup(JSON.stringify(v12))
    expect(parsed.ok && parsed.data.branches.map((b) => b.id)).toEqual(['f1'])
    expect(parsed.ok && parsed.data.groups[0].branchId).toBe('f1')
  })

  it('kelajak versiyasi (v13) zaxirasi rad etiladi', () => {
    expect(parseBackup(JSON.stringify({ ...v11Backup, version: 13 })).ok).toBe(false)
  })
})
