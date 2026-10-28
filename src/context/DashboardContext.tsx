import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { STATUS_LABELS } from '../constants/navigation'
import { useConfirm } from '../hooks/useConfirm'
import { useToast } from '../hooks/useToast'
import { loadData, readStored, resetToMock, saveAll, setItem, STORAGE_KEYS } from '../services/storage.service'
import type { StoredData } from '../services/storage.service'
import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey } from '../types/customer.types'
import type { DateRange, ModalState, Section, SortState } from '../types/dashboard.types'
import type { TransactionFilters, TransactionInput, TransactionSortKey } from '../types/finance.types'
import { EMPTY_CUSTOMER_FILTERS } from '../utils/customers'
import { createId, formatDateWith, formatMoney } from '../utils/format'
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
  const toast = useToast()
  const confirm = useConfirm()
  const [initial] = useState(loadData)
  // Saqlanmagan o'zgarishlar bayrog'i renderga ta'sir qilmaydi, shuning uchun ref
  const unsavedRef = useRef(false)
  const startupNoticeRef = useRef(false)
  const [customers, setCustomers] = useState(initial.data.customers)
  const [transactions, setTransactions] = useState(initial.data.transactions)
  const [settings, setSettings] = useState(initial.data.settings)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [activeSection, setSection] = useState<Section>('overview')
  const [modal, setModal] = useState<ModalState>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [customerFilters, setCustomerFilters] = useState<CustomerFilters>(EMPTY_CUSTOMER_FILTERS)
  const [customerSort, setCustomerSort] = useState<SortState<CustomerSortKey>>({ key: 'createdAt', direction: 'desc' })
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS)
  const [transactionSort, setTransactionSort] = useState<SortState<TransactionSortKey>>({ key: 'date', direction: 'desc' })

  useEffect(() => {
    if (initial.dropped > 0 && !startupNoticeRef.current) {
      startupNoticeRef.current = true
      toast.info(`${initial.dropped} ta buzuq yozuv topildi va tashlab yuborildi`)
    }
  }, [initial.dropped, toast])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unsavedRef.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => setItem(STORAGE_KEYS.customers, customers), [customers])
  useEffect(() => setItem(STORAGE_KEYS.transactions, transactions), [transactions])
  useEffect(() => setItem(STORAGE_KEYS.settings, settings), [settings])

  // Boshqa tabda o'zgargan ma'lumotni shu tabga olib kelish (storage event faqat boshqa tablarda chiqadi)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      const watched: Array<string | null> = [null, STORAGE_KEYS.customers, STORAGE_KEYS.transactions, STORAGE_KEYS.settings]
      if (!watched.includes(event.key)) return
      const { data } = readStored()
      if (event.key === null || event.key === STORAGE_KEYS.customers) setCustomers(data.customers)
      if (event.key === null || event.key === STORAGE_KEYS.transactions) setTransactions(data.transactions)
      if (event.key === null || event.key === STORAGE_KEYS.settings) setSettings(data.settings)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Kassa balansi saqlanmaydi — har safar tranzaksiyalardan hisoblanadi
  const balance = transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)

  const courses = settings.courses

  const getCustomer = (id?: string) => (id ? customers.find((c) => c.id === id) : undefined)
  const money = (amount: number) => formatMoney(amount, settings.currency)

  const applyData = (data: StoredData) => {
    setCustomers(data.customers)
    setTransactions(data.transactions)
    setSettings(data.settings)
    setSearch('')
    setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
    setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
  }

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
    setActiveSection: async (section) => {
      if (section === activeSection) {
        setSidebarOpen(false)
        return
      }
      if (unsavedRef.current) {
        const leave = await confirm({
          title: 'Saqlanmagan o\'zgarishlar',
          message: 'Sozlamalarda saqlanmagan o\'zgarishlar bor. Chiqsangiz, ular yo\'qoladi.',
          confirmLabel: 'Saqlamasdan chiqish',
        })
        if (!leave) return
        unsavedRef.current = false
      }
      setSection(section)
      setSidebarOpen(false)
    },
    setUnsavedChanges: (dirty) => {
      unsavedRef.current = dirty
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
      toast.success(`"${customer.name}" mijozlar bazasiga qo'shildi`)
    },
    updateCustomer: (id, patch) => {
      const updatedAt = new Date().toISOString()
      setCustomers((list) => list.map((c) => (c.id === id ? { ...c, ...cleanCustomer(patch), updatedAt } : c)))
      const name = getCustomer(id)?.name ?? 'Mijoz'
      const keys = Object.keys(patch)
      if (keys.length === 1 && patch.status) toast.success(`${name}: holat "${STATUS_LABELS[patch.status]}" ga o'zgartirildi`)
      else toast.success(`${name} ma'lumotlari saqlandi`)
    },
    deleteCustomer: (id) => {
      const name = getCustomer(id)?.name ?? 'Mijoz'
      setCustomers((list) => list.filter((c) => c.id !== id))
      toast.success(`"${name}" o'chirildi`)
    },
    addTransaction: (data) => {
      setTransactions((list) => [{ ...cleanTransaction(data), id: createId('t') }, ...list])
      toast.success(`${data.type === 'income' ? 'To\'lov' : 'Xarajat'} qayd etildi: ${money(data.amount)}`)
    },
    updateTransaction: (id, patch) => {
      const updatedAt = new Date().toISOString()
      setTransactions((list) => list.map((t) => (t.id === id ? { ...t, ...cleanTransaction(patch), updatedAt } : t)))
      toast.success('Tranzaksiya yangilandi')
    },
    deleteTransaction: (id) => {
      setTransactions((list) => list.filter((t) => t.id !== id))
      toast.success('Tranzaksiya o\'chirildi')
    },
    updateSettings: (next, options) => {
      setSettings(next)
      if (!options?.silent) toast.success('Sozlamalar saqlandi')
    },
    resetData: () => {
      applyData(resetToMock())
      toast.success('Demo ma\'lumotlar tiklandi')
    },
    replaceData: (data) => {
      saveAll(data)
      applyData(data)
      toast.success(`Zaxira tiklandi: ${data.customers.length} mijoz, ${data.transactions.length} tranzaksiya`)
    },
    money,
    formatDate: (iso) => formatDateWith(iso, settings.dateFormat),
    getCustomerName: (id) => getCustomer(id)?.name ?? '—',
  }

  return <DashboardContext value={value}>{children}</DashboardContext>
}
