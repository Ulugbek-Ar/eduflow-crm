import type { TransactionType } from './finance.types'

export type Section = 'overview' | 'customers' | 'finance' | 'courses' | 'analytics' | 'admin' | 'settings' | 'help'

export type DateRange = 'today' | '7d' | 'month' | 'year'

export type Currency = 'UZS' | 'USD'

export type SortDirection = 'asc' | 'desc'

export interface SortState<K extends string> {
  key: K
  direction: SortDirection
}

export type ModalState =
  | { type: 'customer'; payload?: { id?: string } }
  | { type: 'customerDetail'; payload: { id: string } }
  | { type: 'transaction'; payload?: { id?: string; kind?: TransactionType; customerId?: string; amount?: number } }
  | { type: 'course'; payload?: { id?: string } }
  | { type: 'receipt'; payload: { id: string } }
  | null

export type ModalType = NonNullable<ModalState>['type']

export type DateFormat = 'dd.mm.yyyy' | 'dd/mm/yyyy' | 'yyyy-mm-dd'

export type CsvDelimiter = ';' | ','

export interface Settings {
  orgName: string
  logoText: string
  // Logotip rasmi (data URL, 200 KB gacha); '' — harfli logo ko'rsatiladi
  logoImage: string
  phone: string
  address: string
  currency: Currency
  dateFormat: DateFormat
  csvDelimiter: CsvDelimiter
  adminLogin: string
  // Header'dagi profil menyusi: to'liq ism (bo'sh bo'lsa login ko'rsatiladi) va lavozim
  profileName: string
  profileRole: string
}
