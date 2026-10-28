import type { TransactionType } from './finance.types'

export type Section = 'overview' | 'customers' | 'finance' | 'settings'

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
  | { type: 'transaction'; payload?: { id?: string; kind?: TransactionType; customerId?: string } }
  | null

export type ModalType = NonNullable<ModalState>['type']

export interface Settings {
  orgName: string
  currency: Currency
  adminLogin: string
}
