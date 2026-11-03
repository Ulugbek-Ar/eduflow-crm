import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { STATUS_LABELS, TX_STATUS_LABELS } from '../constants/navigation'
import { useConfirm } from '../hooks/useConfirm'
import { isBoolean, usePersistentState } from '../hooks/usePersistentState'
import { useToast } from '../hooks/useToast'
import { combineResults, createEmptyData, isDemoMode, loadData, readStored, resetToMock, saveAll, saveErrorMessage, setDemoMode, setItem, STORAGE_KEYS } from '../services/storage.service'
import type { SaveResult, StoredData } from '../services/storage.service'
import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey } from '../types/customer.types'
import type { DateRange, ModalState, Section, SortState } from '../types/dashboard.types'
import type { TransactionFilters, TransactionInput, TransactionSortKey } from '../types/finance.types'
import type { Course } from '../types/course.types'
import { cashBalance } from '../utils/analytics'
import { normalizeCourseName, usedByCustomers } from '../utils/courses'
import { EMPTY_CUSTOMER_FILTERS, resolveCustomerName } from '../utils/customers'
import { createId, formatDateWith, formatMoney } from '../utils/format'
import { createSaveMonitor } from '../utils/saveMonitor'
import { EMPTY_TRANSACTION_FILTERS } from '../utils/transactions'
import { DashboardContext } from './useDashboard'
import type { DashboardContextValue } from './useDashboard'

function cleanTransaction<T extends Partial<TransactionInput>>(data: T): T {
  const result = { ...data }
  if (result.note !== undefined) result.note = result.note.trim()
  // Manba faqat marketing chiqimida saqlanadi
  if (result.category !== undefined && result.category !== 'marketing') result.source = undefined
  if (result.type === 'expense') result.customerId = undefined
  if ('customerId' in result && !result.customerId) {
    result.customerId = undefined
    result.customerName = undefined
  }
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

export const SIDEBAR_COLLAPSED_KEY = 'apex:sidebar-collapsed'

export function DashboardProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [initial] = useState(loadData)
  // Saqlanmagan o'zgarishlar bayrog'i renderga ta'sir qilmaydi, shuning uchun ref
  const unsavedRef = useRef(false)
  const startupNoticeRef = useRef(false)
  const [saveMonitor] = useState(createSaveMonitor)
  const [customers, setCustomers] = useState(initial.data.customers)
  const [transactions, setTransactions] = useState(initial.data.transactions)
  const [settings, setSettings] = useState(initial.data.settings)
  const [courses, setCourses] = useState(initial.data.courses)
  const [isDemo, setIsDemo] = useState(isDemoMode)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [activeSection, setSection] = useState<Section>('overview')
  const [modal, setModal] = useState<ModalState>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState(SIDEBAR_COLLAPSED_KEY, false, isBoolean)
  const [customerFilters, setCustomerFilters] = useState<CustomerFilters>(EMPTY_CUSTOMER_FILTERS)
  const [customerSort, setCustomerSort] = useState<SortState<CustomerSortKey>>({ key: 'createdAt', direction: 'desc' })
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS)
  const [transactionSort, setTransactionSort] = useState<SortState<TransactionSortKey>>({ key: 'date', direction: 'desc' })

  // Saqlash natijasini kuzatadi: yangi xato bo'lsa bir marta toast chiqadi
  const reportSave = (key: string, result: SaveResult) => {
    const reason = saveMonitor.report(key, result)
    if (reason) toast.error(saveErrorMessage(reason))
  }
  // Effektlardan chaqirish uchun: toast o'zgarsa ham effektlar qayta ishga tushmaydi
  const onSaved = useEffectEvent(reportSave)

  useEffect(() => {
    // Faqat birinchi yuklashda (migratsiyani qayta saqlash muvaffaqiyatsiz bo'lsa)
    if (initial.saveError) onSaved('all', { ok: false, reason: initial.saveError })
  }, [initial.saveError])

  useEffect(() => {
    if (initial.dropped > 0 && !startupNoticeRef.current) {
      startupNoticeRef.current = true
      toast.info(`${initial.dropped} ta buzuq yozuv topildi va tashlab yuborildi`)
    }
  }, [initial.dropped, toast])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Sozlamalarda saqlanmagan forma yoki brauzerga yozib bo'lmagan ma'lumot bor
      if (unsavedRef.current || saveMonitor.isFailing()) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveMonitor])

  // Har bir ro'yxat o'zgarganda alohida yoziladi; natija reportSave orqali kuzatiladi
  useEffect(() => onSaved(STORAGE_KEYS.customers, setItem(STORAGE_KEYS.customers, customers)), [customers])
  useEffect(() => onSaved(STORAGE_KEYS.transactions, setItem(STORAGE_KEYS.transactions, transactions)), [transactions])
  useEffect(() => onSaved(STORAGE_KEYS.settings, setItem(STORAGE_KEYS.settings, settings)), [settings])
  useEffect(() => onSaved(STORAGE_KEYS.courses, setItem(STORAGE_KEYS.courses, courses)), [courses])

  // Boshqa tabda o'zgargan ma'lumotni shu tabga olib kelish (storage event faqat boshqa tablarda chiqadi)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      const watched: Array<string | null> = [null, STORAGE_KEYS.customers, STORAGE_KEYS.transactions, STORAGE_KEYS.settings, STORAGE_KEYS.courses, STORAGE_KEYS.demo]
      if (!watched.includes(event.key)) return
      if (event.key === null || event.key === STORAGE_KEYS.demo) setIsDemo(isDemoMode())
      const { data } = readStored()
      if (event.key === null || event.key === STORAGE_KEYS.customers) setCustomers(data.customers)
      if (event.key === null || event.key === STORAGE_KEYS.transactions) setTransactions(data.transactions)
      if (event.key === null || event.key === STORAGE_KEYS.settings) setSettings(data.settings)
      if (event.key === null || event.key === STORAGE_KEYS.courses) setCourses(data.courses)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Kassa balansi saqlanmaydi — har safar tranzaksiyalardan hisoblanadi
  const balance = cashBalance(transactions)

  const getCustomer = (id?: string) => (id ? customers.find((c) => c.id === id) : undefined)

  // Mijoz tanlangan bo'lsa, uning joriy ismi snapshot sifatida yoziladi
  const withCustomerName = <T extends Partial<TransactionInput>>(data: T): T => {
    const customer = getCustomer(data.customerId)
    return customer ? { ...data, customerName: customer.name } : data
  }

  // O'chirilgan mijozlar ismi tranzaksiyalardagi snapshot'dan olinadi
  const snapshotNames = new Map<string, string>()
  for (const t of transactions) if (t.customerId && t.customerName) snapshotNames.set(t.customerId, t.customerName)
  const money = (amount: number) => formatMoney(amount, settings.currency)

  const applyData = (data: StoredData) => {
    setCustomers(data.customers)
    setTransactions(data.transactions)
    setSettings(data.settings)
    setCourses(data.courses)
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
    sidebarCollapsed,
    balance,
    isDemo,
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
    toggleSidebarCollapsed: () => setSidebarCollapsed(!sidebarCollapsed),
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
      if (keys.length === 1 && patch.status) toast.success(`${name}: bosqich "${STATUS_LABELS[patch.status]}" ga o'zgartirildi`)
      else toast.success(`${name} ma'lumotlari saqlandi`)
    },
    deleteCustomer: (id) => {
      const name = getCustomer(id)?.name ?? 'Mijoz'
      setCustomers((list) => list.filter((c) => c.id !== id))
      // Bog'liq to'lovlar jurnalda qoladi — ism snapshot'i o'chirish paytidagi holatga yangilanadi
      setTransactions((list) => list.map((t) => (t.customerId === id ? { ...t, customerName: name } : t)))
      toast.success(`"${name}" o'chirildi`)
    },
    addTransaction: (data) => {
      setTransactions((list) => [{ ...withCustomerName(cleanTransaction(data)), id: createId('t') }, ...list])
      toast.success(`${data.type === 'income' ? 'To\'lov' : 'Xarajat'} qayd etildi: ${money(data.amount)}`)
    },
    updateTransaction: (id, patch) => {
      const updatedAt = new Date().toISOString()
      const clean = withCustomerName(cleanTransaction(patch))
      setTransactions((list) =>
        list.map((t) => {
          if (t.id !== id) return t
          const next = { ...t, ...clean, updatedAt }
          // To'langan to'lov kelajakda bo'lolmaydi: kutilgan sana o'tmagan bo'lsa, bugungi kun yoziladi
          if (next.status === 'paid' && new Date(next.date).getTime() > Date.now()) next.date = updatedAt
          return next
        }),
      )
      const keys = Object.keys(patch)
      if (keys.every((k) => k === 'status' || k === 'date') && patch.status) toast.success(`Status: "${TX_STATUS_LABELS[patch.status]}"`)
      else toast.success('Tranzaksiya yangilandi')
    },
    deleteTransaction: (id) => {
      setTransactions((list) => list.filter((t) => t.id !== id))
      toast.success('Tranzaksiya o\'chirildi')
    },
    getCourse: (id) => (id ? courses.find((c) => c.id === id) : undefined),
    addCourse: (data) => {
      const course: Course = { ...data, name: normalizeCourseName(data.name), id: createId('k'), createdAt: new Date().toISOString() }
      setCourses((list) => [...list, course])
      toast.success(`"${course.name}" qo'shildi`)
    },
    updateCourse: (id, patch) => {
      const before = courses.find((c) => c.id === id)
      if (!before) return
      const name = patch.name === undefined ? before.name : normalizeCourseName(patch.name)
      setCourses((list) => list.map((c) => (c.id === id ? { ...c, ...patch, name, updatedAt: new Date().toISOString() } : c)))
      if (name !== before.name) {
        setCustomers((list) => list.map((c) => (c.course === before.name ? { ...c, course: name } : c)))
      }
      const keys = Object.keys(patch)
      if (keys.length === 1 && patch.status) {
        toast.success(patch.status === 'archived' ? `"${name}" arxivlandi` : `"${name}" arxivdan qaytarildi`)
      } else {
        toast.success(`"${name}" saqlandi`)
      }
    },
    removeCourse: (id) => {
      const course = courses.find((c) => c.id === id)
      if (!course) return
      if (usedByCustomers(course, customers) > 0) {
        setCourses((list) => list.map((c) => (c.id === id ? { ...c, status: 'archived', updatedAt: new Date().toISOString() } : c)))
        toast.info(`"${course.name}" mijozlari bor — o'chirish o'rniga arxivlandi`)
        return
      }
      setCourses((list) => list.filter((c) => c.id !== id))
      toast.success(`"${course.name}" o'chirildi`)
    },
    updateSettings: (next, options) => {
      setSettings(next)
      if (!options?.silent) toast.success('Sozlamalar saqlandi')
    },
    resetData: () => {
      const { data, saved } = resetToMock()
      applyData(data)
      setIsDemo(true)
      reportSave('all', saved)
      if (saved.ok) toast.success('Demo ma\'lumotlar tiklandi')
    },
    clearAllData: () => {
      const empty = createEmptyData()
      setCustomers(empty.customers)
      setTransactions(empty.transactions)
      setCourses(empty.courses)
      setSearch('')
      setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
      setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
      setIsDemo(false)
      reportSave(STORAGE_KEYS.demo, setDemoMode(false))
      toast.success('Barcha ma\'lumot tozalandi')
    },
    clearDemoData: () => {
      setCustomers([])
      setTransactions([])
      setSearch('')
      setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
      setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
      setIsDemo(false)
      reportSave(STORAGE_KEYS.demo, setDemoMode(false))
      toast.success('Demo ma\'lumot tozalandi — endi o\'z ma\'lumotlaringizni kiritishingiz mumkin')
    },
    replaceData: (data) => {
      // Zaxiradan tiklangan ma'lumot foydalanuvchiniki hisoblanadi
      const saved = saveAll(data)
      applyData(data)
      setIsDemo(false)
      reportSave('all', combineResults([saved, setDemoMode(false)]))
      if (saved.ok) toast.success(`Zaxira tiklandi: ${data.customers.length} mijoz, ${data.transactions.length} tranzaksiya`)
    },
    money,
    formatDate: (iso) => formatDateWith(iso, settings.dateFormat),
    getCustomerName: (id) => resolveCustomerName(id, getCustomer(id), id ? snapshotNames.get(id) : undefined),
  }

  return <DashboardContext value={value}>{children}</DashboardContext>
}
