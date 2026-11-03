import { createContext, useContext } from 'react'
import type { Course, CourseInput } from '../types/course.types'
import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey } from '../types/customer.types'
import type { DateRange, ModalState, Section, Settings, SortState } from '../types/dashboard.types'
import type { StoredData } from '../services/storage.service'
import type { Transaction, TransactionFilters, TransactionInput, TransactionSortKey } from '../types/finance.types'

export interface DashboardContextValue {
  customers: Customer[]
  transactions: Transaction[]
  settings: Settings
  courses: Course[]
  search: string
  dateRange: DateRange
  activeSection: Section
  modal: ModalState
  sidebarOpen: boolean
  // Kompyuterda ixcham (faqat ikonka) sidebar; holat localStorage'da saqlanadi
  sidebarCollapsed: boolean
  balance: number
  // Demo ma'lumot bilan ishlanmoqda
  isDemo: boolean
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
  toggleSidebarCollapsed: () => void
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
  addCourse: (data: CourseInput) => void
  // Nom o'zgarsa, shu kursdagi mijozlarning kurs nomi ham yangilanadi
  updateCourse: (id: string, patch: Partial<CourseInput>) => void
  // Mijozi bor kurs o'chirilmaydi — arxivlanadi
  removeCourse: (id: string) => void
  getCourse: (id?: string) => Course | undefined
  updateSettings: (settings: Settings, options?: { silent?: boolean }) => void
  resetData: () => void
  // Reset: mijozlar, tranzaksiyalar va kurslar o'chadi; sozlamalar va login qoladi
  clearAllData: () => void
  // Demo mijoz va tranzaksiyalarni o'chiradi (sozlamalar qoladi), demo rejimdan chiqadi
  clearDemoData: () => void
  replaceData: (data: StoredData) => void
  money: (amount: number) => string
  formatDate: (iso: string) => string
  setUnsavedChanges: (dirty: boolean) => void
  getCustomerName: (id?: string) => string
}

export const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboard DashboardProvider ichida ishlatilishi kerak')
  return context
}
