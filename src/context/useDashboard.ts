import { createContext, useContext } from 'react'
import type { Customer, NewCustomer } from '../types/customer.types'
import type { DateRange, ModalType, Section, Settings } from '../types/dashboard.types'
import type { NewTransaction, Transaction } from '../types/finance.types'

export interface DashboardContextValue {
  customers: Customer[]
  transactions: Transaction[]
  settings: Settings
  search: string
  dateRange: DateRange
  activeSection: Section
  modal: ModalType
  sidebarOpen: boolean
  balance: number
  setSearch: (value: string) => void
  setDateRange: (range: DateRange) => void
  setActiveSection: (section: Section) => void
  openModal: (modal: Exclude<ModalType, null>) => void
  closeModal: () => void
  toggleSidebar: () => void
  addCustomer: (data: NewCustomer) => void
  deleteCustomer: (id: string) => void
  addTransaction: (data: NewTransaction) => void
  deleteTransaction: (id: string) => void
  updateSettings: (settings: Settings) => void
  resetData: () => void
  money: (amount: number) => string
  getCustomerName: (id?: string) => string
}

export const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboard DashboardProvider ichida ishlatilishi kerak')
  return context
}
