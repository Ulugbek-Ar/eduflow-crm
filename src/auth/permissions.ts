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
  admin: 'Administrator',
  manager: 'Menejer',
  cashier: 'Kassir / Buxgalter',
  viewer: 'Kuzatuvchi',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Hamma narsa: xodimlar, sozlamalar, zaxira, jurnal',
  manager: 'Mijozlar va lidlar bilan ishlash, to\'lov qabul qilish',
  cashier: 'Moliya: to\'lovlar, xarajatlar, hisobotlar',
  viewer: 'Faqat ko\'rish — hech narsani o\'zgartira olmaydi',
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'customers.view': 'Mijozlarni ko\'rish',
  'customers.edit': 'Mijoz qo\'shish va tahrirlash',
  'customers.delete': 'Mijozni o\'chirish',
  'payments.view': 'To\'lovlarni ko\'rish',
  'payments.create': 'To\'lov qabul qilish',
  'payments.manage': 'Xarajat yozish, to\'lovni tahrirlash va o\'chirish',
  'courses.view': 'Kurslarni ko\'rish',
  'courses.edit': 'Kurs va narxlarni o\'zgartirish',
  'analytics.view': 'Tahlilni ko\'rish',
  'reports.export': 'Hisobot yuklab olish',
  'settings.manage': 'Tashkilot sozlamalari',
  'data.manage': 'Zaxira, tiklash, tozalash',
  'staff.manage': 'Xodimlarni boshqarish',
  'audit.view': 'Amallar jurnali',
  'trash.manage': 'O\'chirilganlar savatchasi',
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
