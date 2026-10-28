export type Section = 'overview' | 'customers' | 'finance' | 'settings'

export type DateRange = 'today' | '7d' | 'month' | 'year'

export type Currency = 'UZS' | 'USD'

export type ModalType = 'customer' | 'payment' | null

export interface Settings {
  orgName: string
  currency: Currency
  adminLogin: string
}
