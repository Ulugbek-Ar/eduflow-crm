import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { loadData, resetToMock, setItem, STORAGE_KEYS } from '../services/storage.service'
import type { Customer } from '../types/customer.types'
import type { DateRange, ModalType, Section } from '../types/dashboard.types'
import { createId, formatMoney } from '../utils/format'
import { DashboardContext } from './useDashboard'
import type { DashboardContextValue } from './useDashboard'

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadData)
  const [customers, setCustomers] = useState(initial.customers)
  const [transactions, setTransactions] = useState(initial.transactions)
  const [settings, setSettings] = useState(initial.settings)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [activeSection, setSection] = useState<Section>('overview')
  const [modal, setModal] = useState<ModalType>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => setItem(STORAGE_KEYS.customers, customers), [customers])
  useEffect(() => setItem(STORAGE_KEYS.transactions, transactions), [transactions])
  useEffect(() => setItem(STORAGE_KEYS.settings, settings), [settings])

  // Kassa balansi saqlanmaydi — har safar tranzaksiyalardan hisoblanadi
  const balance = transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)

  const value: DashboardContextValue = {
    customers,
    transactions,
    settings,
    search,
    dateRange,
    activeSection,
    modal,
    sidebarOpen,
    balance,
    setSearch,
    setDateRange,
    setActiveSection: (section) => {
      setSection(section)
      setSidebarOpen(false)
    },
    openModal: (next) => setModal(next),
    closeModal: () => setModal(null),
    toggleSidebar: () => setSidebarOpen((open) => !open),
    addCustomer: (data) => {
      const customer: Customer = { ...data, id: createId('c'), createdAt: new Date().toISOString() }
      setCustomers((list) => [customer, ...list])
    },
    deleteCustomer: (id) => setCustomers((list) => list.filter((c) => c.id !== id)),
    addTransaction: (data) => {
      setTransactions((list) => [{ ...data, id: createId('t') }, ...list])
    },
    deleteTransaction: (id) => setTransactions((list) => list.filter((t) => t.id !== id)),
    updateSettings: setSettings,
    resetData: () => {
      const mock = resetToMock()
      setCustomers(mock.customers)
      setTransactions(mock.transactions)
      setSettings(mock.settings)
      setSearch('')
    },
    money: (amount) => formatMoney(amount, settings.currency),
    getCustomerName: (id) => customers.find((c) => c.id === id)?.name ?? '—',
  }

  return <DashboardContext value={value}>{children}</DashboardContext>
}
