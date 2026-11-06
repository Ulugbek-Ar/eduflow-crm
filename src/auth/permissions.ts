import { tr } from '../i18n'
import type { Role } from '../types/user.types'
import type { Section } from '../types/dashboard.types'

// Ruxsatlar jadvali — bitta joyda. Har tugma, bo'lim va amal shu jadvalga qarab ko'rinadi yoki yopiladi
export type Permission =
  | 'customers.view'
  | 'customers.edit'
  | 'customers.delete'
  | 'payments.view'
  | 'payments.create'
  | 'payments.manage'
  | 'courses.view'
  | 'courses.edit'
  | 'analytics.view'
  | 'reports.export'
  | 'settings.manage'
  | 'data.manage'
  | 'staff.manage'
  | 'audit.view'
  | 'trash.manage'

export const ROLES: readonly Role[] = ['admin', 'manager', 'cashier', 'viewer']

export const ROLE_LABELS: Record<Role, string> = {
  admin: tr('Administrator'),
  manager: tr('Menejer'),
  cashier: tr('Kassir / Buxgalter'),
  viewer: tr('Kuzatuvchi'),
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: tr('Hamma narsa: xodimlar, sozlamalar, zaxira, jurnal'),
  manager: tr('Mijozlar va lidlar bilan ishlash, to\'lov qabul qilish'),
  cashier: tr('Moliya: to\'lovlar, xarajatlar, hisobotlar'),
  viewer: tr('Faqat ko\'rish — hech narsani o\'zgartira olmaydi'),
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'customers.view': tr('Mijozlarni ko\'rish'),
  'customers.edit': tr('Mijoz qo\'shish va tahrirlash'),
  'customers.delete': tr('Mijozni o\'chirish'),
  'payments.view': tr('To\'lovlarni ko\'rish'),
  'payments.create': tr('To\'lov qabul qilish'),
  'payments.manage': tr('Xarajat yozish, to\'lovni tahrirlash va o\'chirish'),
  'courses.view': tr('Kurslarni ko\'rish'),
  'courses.edit': tr('Kurs va narxlarni o\'zgartirish'),
  'analytics.view': tr('Tahlilni ko\'rish'),
  'reports.export': tr('Hisobot yuklab olish'),
  'settings.manage': tr('Tashkilot sozlamalari'),
  'data.manage': tr('Zaxira, tiklash, tozalash'),
  'staff.manage': tr('Xodimlarni boshqarish'),
  'audit.view': tr('Amallar jurnali'),
  'trash.manage': tr('O\'chirilganlar savatchasi'),
}

const ALL: readonly Permission[] = Object.keys(PERMISSION_LABELS) as Permission[]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ALL,
  manager: ['customers.view', 'customers.edit', 'customers.delete', 'payments.view', 'payments.create', 'courses.view'],
  cashier: ['customers.view', 'payments.view', 'payments.create', 'payments.manage', 'courses.view', 'analytics.view', 'reports.export'],
  viewer: ['customers.view', 'payments.view', 'courses.view', 'analytics.view'],
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false
}

// Bo'limni ko'rish uchun kerak bo'lgan ruxsat (null — hammaga ochiq)
export const SECTION_PERMISSION: Record<Section, Permission | null> = {
  overview: null,
  customers: 'customers.view',
  finance: 'payments.view',
  courses: 'courses.view',
  analytics: 'analytics.view',
  admin: 'staff.manage',
  settings: null,
  help: null,
}

export function canOpenSection(role: Role | null | undefined, section: Section): boolean {
  const permission = SECTION_PERMISSION[section]
  return permission === null ? Boolean(role) : can(role, permission)
}
