import { createElement } from 'react'
import type { CustomerSource, CustomerStatus } from '../types/customer.types'
import type { DateRange, Section } from '../types/dashboard.types'
import type { PaymentMethod, TransactionType } from '../types/finance.types'

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
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'm19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  trendUp: ['m23 6-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  userCheck: ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'm17 11 2 2 4-4'],
  percent: ['M19 5 5 19', 'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  card: ['M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M1 10h22'],
  refresh: ['M1 4v6h6', 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10'],
  save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8'],
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
