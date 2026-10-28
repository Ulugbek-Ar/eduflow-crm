import { createElement } from 'react'
import type { CustomerSource, CustomerStatus } from '../types/customer.types'
import type { DateRange, Section } from '../types/dashboard.types'
import type { ExpenseCategory, IncomeCategory, PaymentMethod, TransactionCategory, TransactionType } from '../types/finance.types'

// Ikonlar: 24x24 viewBox, stroke uslubida chiziladigan path'lar
export const ICONS = {
  logo: ['M3 20 12 4l9 16', 'M7.5 14h9'],
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
  { id: 'overview', label: 'Umumiy ko\'rinish', icon: 'overview' },
  { id: 'customers', label: 'Mijozlar', icon: 'customers' },
  { id: 'finance', label: 'Moliya', icon: 'finance' },
  { id: 'settings', label: 'Sozlamalar', icon: 'settings' },
]

// Interfeys yorliqlari
export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'Bugun',
  '7d': '7 kun',
  month: 'Shu oy',
  year: 'Shu yil',
}

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  lead: 'Lead',
  active: 'Faol',
  paused: 'To\'xtatilgan',
  left: 'Ketgan',
}

export const SOURCE_LABELS: Record<CustomerSource, string> = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  website: 'Veb-sayt',
  referral: 'Tavsiya',
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  payme: 'Payme',
  click: 'Click',
  cash: 'Naqd',
  bank: 'Bank o\'tkazmasi',
}

export const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Kirim',
  expense: 'Chiqim',
}

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  course_fee: 'Kurs to\'lovi',
  other_income: 'Boshqa kirim',
  rent: 'Ijara',
  salary: 'Maosh',
  marketing: 'Marketing',
  equipment: 'Jihozlar',
  utilities: 'Kommunal xizmatlar',
  other_expense: 'Boshqa chiqim',
}

export const INCOME_CATEGORIES: readonly IncomeCategory[] = ['course_fee', 'other_income']

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = ['rent', 'salary', 'marketing', 'equipment', 'utilities', 'other_expense']

export function categoriesFor(type: TransactionType): readonly TransactionCategory[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}
