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
  | 'groups.view'
  | 'groups.edit'
  | 'attendance.view'
  | 'attendance.mark'
  | 'teachers.manage'
  | 'payroll.view'
  | 'payroll.manage'

export const ROLES: readonly Role[] = ['admin', 'manager', 'cashier', 'viewer', 'teacher']

export const ROLE_LABELS: Record<Role, string> = {
  admin: tr('Administrator'),
  manager: tr('Menejer'),
  cashier: tr('Kassir / Buxgalter'),
  viewer: tr('Kuzatuvchi'),
  teacher: tr('O\'qituvchi'),
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: tr('Hamma narsa: xodimlar, sozlamalar, zaxira, jurnal'),
  manager: tr('Mijozlar, lidlar va guruhlar, davomat, to\'lov qabul qilish'),
  cashier: tr('Moliya: to\'lovlar, xarajatlar, maosh, hisobotlar'),
  viewer: tr('Faqat ko\'rish — hech narsani o\'zgartira olmaydi'),
  teacher: tr('Faqat o\'z guruhlari, dars jadvali va davomati'),
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
  'groups.view': tr('Guruhlar va dars jadvalini ko\'rish'),
  'groups.edit': tr('Guruh ochish, o\'quvchini guruhga qo\'shish'),
  'attendance.view': tr('Davomatni ko\'rish'),
  'attendance.mark': tr('Davomat belgilash'),
  'teachers.manage': tr('O\'qituvchilarni boshqarish'),
  'payroll.view': tr('O\'qituvchi maoshini ko\'rish'),
  'payroll.manage': tr('Maosh to\'lash'),
}

const ALL: readonly Permission[] = Object.keys(PERMISSION_LABELS) as Permission[]

// DIQQAT: bulutda xuddi shu jadval — supabase/migrations dagi oxirgi role_has_permission() funksiyasi.
// Mosligi src/auth/permissions.test.ts da (SQL migratsiyalarni o'qib) tekshiriladi
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ALL,
  manager: [
    'customers.view',
    'customers.edit',
    'customers.delete',
    'payments.view',
    'payments.create',
    'courses.view',
    'groups.view',
    'groups.edit',
    'attendance.view',
    'attendance.mark',
  ],
  cashier: [
    'customers.view',
    'payments.view',
    'payments.create',
    'payments.manage',
    'courses.view',
    'analytics.view',
    'reports.export',
    'groups.view',
    'attendance.view',
    'payroll.view',
    'payroll.manage',
  ],
  viewer: ['customers.view', 'payments.view', 'courses.view', 'analytics.view', 'groups.view', 'attendance.view', 'payroll.view'],
  // O'qituvchi: faqat o'z guruhlari (Teacher.userId) — cheklov ma'lumot qatlamida (DashboardContext, RLS)
  teacher: ['groups.view', 'attendance.view', 'attendance.mark'],
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false
}

// Bo'limni ko'rish uchun kerak bo'lgan ruxsat (null — hammaga ochiq; massiv — istalgan biri yetarli)
export const SECTION_PERMISSION: Record<Section, Permission | readonly Permission[] | null> = {
  overview: null,
  customers: 'customers.view',
  groups: 'groups.view',
  schedule: 'groups.view',
  // "Davomat" alohida bo'lim sifatida faqat o'qituvchi menyusida (boshqalar uchun — guruh kartasida)
  attendance: 'attendance.mark',
  finance: 'payments.view',
  courses: 'courses.view',
  teachers: ['teachers.manage', 'payroll.view'],
  analytics: 'analytics.view',
  admin: 'staff.manage',
  settings: null,
  help: null,
}

export function sectionAllowed(role: Role | null | undefined, section: Section): boolean {
  const permission = SECTION_PERMISSION[section]
  if (permission === null) return Boolean(role)
  return typeof permission === 'string' ? can(role, permission) : permission.some((p) => can(role, p))
}

// Menyuda ko'rsatiladimi: "Davomat" faqat o'qituvchiga (administrator davomatni guruh kartasidan belgilaydi)
export function canOpenSection(role: Role | null | undefined, section: Section): boolean {
  if (section === 'attendance') return role === 'teacher'
  return sectionAllowed(role, section)
}

// Bo'limga kirish uchun birinchi yetarli ruxsat (rad etilganda xabar uchun)
export function sectionPermissions(section: Section): readonly Permission[] {
  const permission = SECTION_PERMISSION[section]
  if (permission === null) return []
  return typeof permission === 'string' ? [permission] : permission
}
