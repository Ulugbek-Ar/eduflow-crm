import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { COURSES } from '../constants/mockData'
import { loadData, resetToMock, setItem, STORAGE_KEYS } from '../services/storage.service'
import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey } from '../types/customer.types'
import type { DateRange, ModalState, Section, SortState } from '../types/dashboard.types'
import type { TransactionFilters, TransactionInput, TransactionSortKey } from '../types/finance.types'
import { EMPTY_CUSTOMER_FILTERS } from '../utils/customers'
import { createId, formatMoney } from '../utils/format'
import { EMPTY_TRANSACTION_FILTERS } from '../utils/transactions'
import { DashboardContext } from './useDashboard'
import type { DashboardContextValue } from './useDashboard'

function cleanTransaction<T extends Partial<TransactionInput>>(data: T): T {
  const result = { ...data }
  if (result.note !== undefined) result.note = result.note.trim()
  if (result.type === 'expense') result.customerId = undefined
  if ('customerId' in result && !result.customerId) result.customerId = undefined
  return result
}

// Bo'sh satrlarni saqlamaslik uchun ixtiyoriy maydonlarni tozalaydi
function cleanCustomer<T extends Partial<CustomerInput>>(data: T): T {
  const result = { ...data }
  if (result.name !== undefined) result.name = result.name.trim()
  if (result.email !== undefined) result.email = result.email.trim() || undefined
  if (result.note !== undefined) result.note = result.note.trim() || undefined
  return result
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadData)
  const [customers, setCustomers] = useState(initial.customers)
  const [transactions, setTransactions] = useState(initial.transactions)
  const [settings, setSettings] = useState(initial.settings)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [activeSection, setSection] = useState<Section>('overview')
  const [modal, setModal] = useState<ModalState>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [customerFilters, setCustomerFilters] = useState<CustomerFilters>(EMPTY_CUSTOMER_FILTERS)
  const [customerSort, setCustomerSort] = useState<SortState<CustomerSortKey>>({ key: 'createdAt', direction: 'desc' })
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS)
  const [transactionSort, setTransactionSort] = useState<SortState<TransactionSortKey>>({ key: 'date', direction: 'desc' })

  useEffect(() => setItem(STORAGE_KEYS.customers, customers), [customers])
  useEffect(() => setItem(STORAGE_KEYS.transactions, transactions), [transactions])
  useEffect(() => setItem(STORAGE_KEYS.settings, settings), [settings])

  // Kassa balansi saqlanmaydi — har safar tranzaksiyalardan hisoblanadi
  const balance = transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)

  // Standart kurslar + mijozlarda uchraydigan boshqa kurslar
  const courses = Array.from(new Set([...COURSES, ...customers.map((c) => c.course)]))

  const getCustomer = (id?: string) => (id ? customers.find((c) => c.id === id) : undefined)

  const value: DashboardContextValue = {
    customers,
    transactions,
    settings,
    courses,
    search,
    dateRange,
    activeSection,
    modal,
    sidebarOpen,
    balance,
    customerFilters,
    customerSort,
    transactionFilters,
    transactionSort,
    setSearch,
    setDateRange,
    setActiveSection: (section) => {
      setSection(section)
      setSidebarOpen(false)
    },
    openModal: (next) => setModal(next),
    closeModal: () => setModal(null),
    toggleSidebar: () => setSidebarOpen((open) => !open),
    setCustomerFilters,
    setCustomerSort,
    setTransactionFilters,
    setTransactionSort,
    getCustomer,
    getTransaction: (id) => (id ? transactions.find((t) => t.id === id) : undefined),
    addCustomer: (data) => {
      const customer: Customer = { ...cleanCustomer(data), id: createId('c'), createdAt: new Date().toISOString() }
      setCustomers((list) => [customer, ...list])
    },
    updateCustomer: (id, patch) => {
      const updatedAt = new Date().toISOString()
      setCustomers((list) => list.map((c) => (c.id === id ? { ...c, ...cleanCustomer(patch), updatedAt } : c)))
    },
    deleteCustomer: (id) => setCustomers((list) => list.filter((c) => c.id !== id)),
    addTransaction: (data) => {
      setTransactions((list) => [{ ...cleanTransaction(data), id: createId('t') }, ...list])
    },
    updateTransaction: (id, patch) => {
      const updatedAt = new Date().toISOString()
      setTransactions((list) => list.map((t) => (t.id === id ? { ...t, ...cleanTransaction(patch), updatedAt } : t)))
    },
    deleteTransaction: (id) => setTransactions((list) => list.filter((t) => t.id !== id)),
    updateSettings: setSettings,
    resetData: () => {
      const mock = resetToMock()
      setCustomers(mock.customers)
      setTransactions(mock.transactions)
      setSettings(mock.settings)
      setSearch('')
      setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
      setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
    },
    money: (amount) => formatMoney(amount, settings.currency),
    getCustomerName: (id) => getCustomer(id)?.name ?? '—',
  }

  return <DashboardContext value={value}>{children}</DashboardContext>
}
