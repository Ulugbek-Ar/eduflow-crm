import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '../constants/navigation'
import { can, canOpenSection, PERMISSION_LABELS, ROLE_PERMISSIONS, ROLES } from './permissions'
import type { Permission } from './permissions'

describe('ruxsatlar jadvali', () => {
  it('administrator hamma narsani qila oladi', () => {
    for (const permission of Object.keys(PERMISSION_LABELS) as Permission[]) expect(can('admin', permission)).toBe(true)
  })

  it('kuzatuvchi hech narsani o\'zgartira olmaydi', () => {
    expect(ROLE_PERMISSIONS.viewer.every((p) => p.endsWith('.view'))).toBe(true)
  })

  it('menejer: mijozlar va to\'lov qabul qilish; xarajat, sozlama va eksport — yo\'q', () => {
    expect(can('manager', 'customers.edit')).toBe(true)
    expect(can('manager', 'payments.create')).toBe(true)
    expect(can('manager', 'payments.manage')).toBe(false)
    expect(can('manager', 'reports.export')).toBe(false)
    expect(can('manager', 'settings.manage')).toBe(false)
  })

  it('kassir: moliya va hisobotlar; mijozni tahrirlay olmaydi', () => {
    expect(can('cashier', 'payments.manage')).toBe(true)
    expect(can('cashier', 'reports.export')).toBe(true)
    expect(can('cashier', 'customers.edit')).toBe(false)
    expect(can('cashier', 'staff.manage')).toBe(false)
  })

  it('kirmagan foydalanuvchi uchun hammasi yopiq', () => {
    expect(can(null, 'customers.view')).toBe(false)
    expect(canOpenSection(undefined, 'overview')).toBe(false)
  })

  it('har bo\'lim uchun ruxsat belgilangan; "Boshqaruv" faqat administratorga', () => {
    for (const role of ROLES) {
      expect(canOpenSection(role, 'overview')).toBe(true)
      expect(canOpenSection(role, 'settings')).toBe(true)
      expect(canOpenSection(role, 'admin')).toBe(role === 'admin')
    }
    expect(NAV_ITEMS.every((item) => typeof canOpenSection('viewer', item.id) === 'boolean')).toBe(true)
  })
})

// Bulutdagi ruxsatlar (SQL role_has_permission) — TS jadval bilan aynan bir xil bo'lishi shart
describe('SQL has_permission() <-> src/auth/permissions.ts', () => {
  const migrations = import.meta.glob('/supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

  // Migratsiyalar nomi bo'yicha tartibda bajariladi — oxirgi "create or replace" amal qiladi
  function sqlTable(): Map<string, Set<string> | 'all'> {
    const files = Object.keys(migrations).sort()
    let body = ''
    for (const file of files) {
      const matches = [...migrations[file].matchAll(/function public\.role_has_permission\([\s\S]*?\$\$([\s\S]*?)\$\$/g)]
      if (matches.length) body = matches[matches.length - 1][1]
    }
    const table = new Map<string, Set<string> | 'all'>()
    for (const m of body.matchAll(/when '(\w+)' then (true|p = any \(array\[([^\]]*)\]\))/g)) {
      table.set(m[1], m[2] === 'true' ? 'all' : new Set([...m[3].matchAll(/'([\w.]+)'/g)].map((x) => x[1])))
    }
    return table
  }

  it('har bir rol uchun ruxsatlar to\'plami bir xil', () => {
    const table = sqlTable()
    expect(Object.keys(migrations).length).toBeGreaterThanOrEqual(2)
    expect([...table.keys()].sort()).toEqual([...ROLES].sort())
    for (const role of ROLES) {
      const sql = table.get(role)
      const ts = new Set(ROLE_PERMISSIONS[role])
      if (sql === 'all') expect(ts, role).toEqual(new Set(Object.keys(PERMISSION_LABELS)))
      else expect(sql, role).toEqual(ts)
    }
  })

  it('o\'qituvchi: faqat guruh va davomat; mijoz, to\'lov, maosh — yo\'q', () => {
    expect(ROLE_PERMISSIONS.teacher).toEqual(['groups.view', 'attendance.view', 'attendance.mark'])
    expect(canOpenSection('teacher', 'groups')).toBe(true)
    expect(canOpenSection('teacher', 'attendance')).toBe(true)
    expect(canOpenSection('teacher', 'customers')).toBe(false)
    expect(canOpenSection('teacher', 'finance')).toBe(false)
    expect(canOpenSection('teacher', 'teachers')).toBe(false)
    // "Davomat" bo'limi menyuda faqat o'qituvchiga; boshqalar davomatni guruh kartasida belgilaydi
    expect(canOpenSection('admin', 'attendance')).toBe(false)
    expect(canOpenSection('cashier', 'teachers')).toBe(true)
    expect(can('cashier', 'attendance.mark')).toBe(false)
    expect(can('manager', 'groups.edit')).toBe(true)
  })
})
