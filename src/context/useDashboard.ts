import { createContext, useContext } from 'react'
import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey } from '../types/customer.types'
import type { DateRange, ModalState, Section, Settings, SortState } from '../types/dashboard.types'
import type { Transaction, TransactionFilters, TransactionInput, TransactionSortKey } from '../types/finance.types'

export interface DashboardContextValue {
  customers: Customer[]
  transactions: Transaction[]
  settings: Settings
  courses: string[]
  search: string
  dateRange: DateRange
  activeSection: Section
  modal: ModalState
  sidebarOpen: boolean
  balance: number
  customerFilters: CustomerFilters
  customerSort: SortState<CustomerSortKey>
  transactionFilters: TransactionFilters
  transactionSort: SortState<TransactionSortKey>
  setSearch: (value: string) => void
  setDateRange: (range: DateRange) => void
  setActiveSection: (section: Section) => void
  openModal: (modal: NonNullable<ModalState>) => void
  closeModal: () => void
  toggleSidebar: () => void
  setCustomerFilters: (filters: CustomerFilters) => void
  setCustomerSort: (sort: SortState<CustomerSortKey>) => void
  setTransactionFilters: (filters: TransactionFilters) => void
  setTransactionSort: (sort: SortState<TransactionSortKey>) => void
  getCustomer: (id?: string) => Customer | undefined
  addCustomer: (data: CustomerInput) => void
  updateCustomer: (id: string, patch: Partial<CustomerInput>) => void
  deleteCustomer: (id: string) => void
  getTransaction: (id?: string) => Transaction | undefined
  addTransaction: (data: TransactionInput) => void
  updateTransaction: (id: string, patch: Partial<TransactionInput>) => void
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
