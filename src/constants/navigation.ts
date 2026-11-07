import { tr } from '../i18n'
import { createElement } from 'react'
import type { CustomerSource, CustomerStatus } from '../types/customer.types'
import type { DateRange, Section } from '../types/dashboard.types'
import type { ExpenseCategory, IncomeCategory, PaymentMethod, TransactionCategory, TransactionStatus, TransactionType } from '../types/finance.types'

// Ikonlar: 24x24 viewBox, stroke uslubida chiziladigan path'lar
export const ICONS = {
  // Bitiruvchi qalpoqchasi — ta'lim belgisi
  logo: ['M2 9.5 12 5l10 4.5-10 4.5z', 'M6 11.3V16c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.7', 'M22 9.5V15'],
  overview: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'],
  customers: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  finance: ['M20 7H5a2 2 0 0 1 0-4h13v4', 'M3 5v14a2 2 0 0 0 2 2h15V7', 'M16 14h2'],
  settings: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'm21 21-4.35-4.35'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  trash: ['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'm19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'],
  edit: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  check: ['M20 6 9 17l-5-5'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  chevronDown: ['m6 9 6 6 6-6'],
  arrowUp: ['M12 19V5', 'm5 12 7-7 7 7'],
  arrowDown: ['M12 5v14', 'm19 12-7 7-7-7'],
  sort: ['m21 16-4 4-4-4', 'M17 20V4', 'm3 8 4-4 4 4', 'M7 4v16'],
  arrowUpRight: ['M7 17 17 7', 'M7 7h10v10'],
  arrowDownRight: ['m7 7 10 10', 'M17 7v10H7'],
  trendUp: ['m23 6-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  trendDown: ['m23 18-9.5-9.5-5 5L1 6', 'M17 18h6v-6'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  userCheck: ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'm17 11 2 2 4-4'],
  percent: ['M19 5 5 19', 'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  card: ['M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M1 10h22'],
  receipt: ['M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .67V2l-1 .67L16 2l-3 2-3-2-3 2-3-2Z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  refresh: ['M1 4v6h6', 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10'],
  save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8'],
  phone: [
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  ],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 6-10 7L2 6'],
  alert: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  sun: [
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M12 1v2',
    'M12 21v2',
    'm4.22 4.22 1.42 1.42',
    'm18.36 18.36 1.42 1.42',
    'M1 12h2',
    'M21 12h2',
    'm4.22 19.78 1.42-1.42',
    'm18.36 5.64 1.42-1.42',
  ],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  monitor: ['M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 21h8', 'M12 17v4'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  fileText: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
  sheet: ['M3 3h18v18H3z', 'M3 9h18', 'M3 15h18', 'M9 3v18'],
  database: [
    'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z',
    'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3',
    'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5',
  ],
  building: ['M3 21h18', 'M5 21V7l8-4v18', 'M19 21V11l-6-4', 'M9 9h.01', 'M9 13h.01', 'M9 17h.01'],
  globe: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  // Lucide uslubidagi qo'shimcha ikonlar (24x24, stroke 2)
  dollar: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  bookOpen: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
  barChart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  kanban: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 7v7', 'M12 7v4', 'M16 7v9'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  panelLeft: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 3v18'],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  calendar: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  archive: ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
  image: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    'm21 15-5-5L5 21',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  key: ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4'],
  ban: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'm4.93 4.93 14.14 14.14'],
  copy: ['M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  play: ['m5 3 14 9-14 9V3z'],
  move: ['M5 9l-3 3 3 3', 'M9 5l3-3 3 3', 'M15 19l-3 3-3-3', 'M19 9l3 3-3 3', 'M2 12h20', 'M12 2v20'],
  layers: ['m12 2 10 5-10 5L2 7z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  briefcase: ['M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2'],
  checkSquare: ['m9 11 3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
} as const

export type IconName = keyof typeof ICONS

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 18, className }: IconProps) {
  return createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      'aria-hidden': true,
    },
    ICONS[name].map((d) => createElement('path', { key: d, d })),
  )
}

export interface NavItem {
  id: Section
  label: string
  icon: IconName
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'overview', label: tr('Umumiy ko\'rinish'), icon: 'overview' },
  { id: 'customers', label: tr('Mijozlar va lidlar'), icon: 'customers' },
  { id: 'groups', label: tr('Guruhlar'), icon: 'layers' },
  // Faqat o'qituvchi menyusida (permissions.ts: canOpenSection)
  { id: 'attendance', label: tr('Davomat'), icon: 'checkSquare' },
  { id: 'finance', label: tr('Moliya va kassa'), icon: 'dollar' },
  { id: 'courses', label: tr('Kurslar va xizmatlar'), icon: 'bookOpen' },
  { id: 'teachers', label: tr('O\'qituvchilar'), icon: 'briefcase' },
  { id: 'analytics', label: tr('Tahlil va hisobotlar'), icon: 'barChart' },
  { id: 'admin', label: tr('Boshqaruv'), icon: 'shield' },
  { id: 'settings', label: tr('Sozlamalar'), icon: 'settings' },
  { id: 'help', label: tr('Yordam'), icon: 'info' },
]

// O'qituvchi menyusida ba'zi bo'limlar o'z nomi bilan
const TEACHER_LABELS: Partial<Record<Section, string>> = { overview: tr('Bugun'), groups: tr('Guruhlarim') }

export function sectionLabel(section: Section, role?: string): string {
  if (role === 'teacher' && TEACHER_LABELS[section]) return TEACHER_LABELS[section]
  return NAV_ITEMS.find((item) => item.id === section)?.label ?? ''
}

// Interfeys yorliqlari
export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: tr('Bugun'),
  '7d': tr('7 kun'),
  month: tr('Shu oy'),
  year: tr('Shu yil'),
}

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  new: tr('Yangi'),
  contacted: tr('Bog\'lanildi'),
  thinking: tr('O\'ylayapti'),
  paid: tr('To\'lov qildi'),
  cancelled: tr('Bekor qilindi'),
}

// Voronka tartibi: Kanban ustunlari, saralash va filtrlar shu tartibda
export const FUNNEL_STAGES: readonly CustomerStatus[] = ['new', 'contacted', 'thinking', 'paid', 'cancelled']

export const SOURCE_LABELS: Record<CustomerSource, string> = {
  telegram: tr('Telegram'),
  instagram: tr('Instagram'),
  website: tr('Sayt'),
  referral: tr('Tavsiya'),
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: tr('Naqd'),
  card: tr('Karta'),
  transfer: tr('O\'tkazma'),
}

export const TX_STATUS_LABELS: Record<TransactionStatus, string> = {
  paid: tr('To\'langan'),
  pending: tr('Kutilmoqda'),
  cancelled: tr('Bekor qilingan'),
}

export const TYPE_LABELS: Record<TransactionType, string> = {
  income: tr('Kirim'),
  expense: tr('Chiqim'),
}

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  course_fee: tr('Kurs to\'lovi'),
  other_income: tr('Boshqa kirim'),
  rent: tr('Ijara'),
  salary: tr('Maosh'),
  marketing: tr('Marketing'),
  equipment: tr('Jihozlar'),
  utilities: tr('Kommunal xizmatlar'),
  other_expense: tr('Boshqa chiqim'),
}

export const INCOME_CATEGORIES: readonly IncomeCategory[] = ['course_fee', 'other_income']

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = ['rent', 'salary', 'marketing', 'equipment', 'utilities', 'other_expense']

export function categoriesFor(type: TransactionType): readonly TransactionCategory[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}
