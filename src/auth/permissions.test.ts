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
