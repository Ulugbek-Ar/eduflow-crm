import { useContext, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SECTION_PERMISSION } from '../auth/permissions'
import type { Permission } from '../auth/permissions'
import { CATEGORY_LABELS, STATUS_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../constants/navigation'
import { AuthContext, useAuditActor, useCan } from '../hooks/useAuth'
import { logAudit } from '../services/audit.service'
import type { AuditAction } from '../services/audit.service'
import { isTourDone, markTourDone } from '../services/tour.service'
import { loadTrash, pruneTrash, saveTrash, TRASH_KEY } from '../services/trash.service'
import type { TrashEntry, TrashKind } from '../services/trash.service'
import { useConfirm } from '../hooks/useConfirm'
import { isBoolean, usePersistentState } from '../hooks/usePersistentState'
import { useToast } from '../hooks/useToast'
import {
  combineResults,
  createEmptyData,
  isDemoMode,
  loadData,
  physicalKey,
  readStored,
  resetToMock,
  saveAll,
  saveErrorMessage,
  setDemoMode,
  setItem,
  STORAGE_KEYS,
} from '../services/storage.service'
import type { SaveResult, StoredData } from '../services/storage.service'
import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey } from '../types/customer.types'
import type { DateRange, ModalState, ModalType, Section, SortState } from '../types/dashboard.types'
import type { Transaction, TransactionFilters, TransactionInput, TransactionSortKey } from '../types/finance.types'
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

// "To'lov qildi" bosqichiga o'tilsa — shu vaqt, chiqilsa — o'chiriladi; bosqich o'zgarmasa — avvalgisi
function withPaidAt(before: Customer, after: Customer, now: string): Customer {
  if (after.status === before.status) return after
  if (after.status === 'paid') return { ...after, paidAt: now }
  const { paidAt: _paidAt, ...rest } = after
  return rest
}

export const SIDEBAR_COLLAPSED_KEY = 'apex:sidebar-collapsed'

export const DENIED_MESSAGE = 'Bu amal uchun ruxsatingiz yo\'q. Administratorga murojaat qiling.'

// Oyna ochish uchun kerakli ruxsat
function modalPermission(modal: NonNullable<ModalState>): Permission {
  const byType: Record<ModalType, Permission> = {
    customer: 'customers.edit',
    customerDetail: 'customers.view',
    course: 'courses.edit',
    transaction: 'payments.create',
  }
  if (modal.type === 'transaction' && (modal.payload?.id || modal.payload?.kind === 'expense')) return 'payments.manage'
  return byType[modal.type]
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const confirm = useConfirm()
  const can = useCan()
  const actor = useAuditActor()
  const authMode = useContext(AuthContext)?.mode
  // Demo markazda rol almashtirilsa ham tanishtiruv qayta chiqmaydi
  const tourKey = authMode === 'demo' ? 'demo' : (actor?.userId ?? 'local')
  const [tourOpen, setTourOpen] = useState(() => Boolean(actor) && !isTourDone(tourKey))
  const [initial] = useState(loadData)
  const [trash, setTrash] = useState(() => loadTrash())
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
  useEffect(() => onSaved(TRASH_KEY, saveTrash(trash)), [trash])

  // Boshqa tabda o'zgargan ma'lumotni shu tabga olib kelish (storage event faqat boshqa tablarda chiqadi)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      // Demo rejimda kalitlar boshqa nom maydonida (eduflow-demo:*)
      const is = (key: string) => event.key === null || event.key === physicalKey(key)
      const watched = [STORAGE_KEYS.customers, STORAGE_KEYS.transactions, STORAGE_KEYS.settings, STORAGE_KEYS.courses, STORAGE_KEYS.demo, TRASH_KEY]
      if (!watched.some(is)) return
      if (is(TRASH_KEY)) setTrash(loadTrash())
      if (is(STORAGE_KEYS.demo)) setIsDemo(isDemoMode())
      const { data } = readStored()
      if (is(STORAGE_KEYS.customers)) setCustomers(data.customers)
      if (is(STORAGE_KEYS.transactions)) setTransactions(data.transactions)
      if (is(STORAGE_KEYS.settings)) setSettings(data.settings)
      if (is(STORAGE_KEYS.courses)) setCourses(data.courses)
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

  // Ruxsat bo'lmasa amal bajarilmaydi (tugmalar ham yashiriladi — bu ikkinchi himoya qatlami)
  const allowed = (permission: Permission): boolean => {
    if (can(permission)) return true
    toast.error(DENIED_MESSAGE)
    return false
  }

  const audit = (action: AuditAction, summary: string, entityId?: string) => logAudit(actor, action, summary, entityId)

  const txSummary = (t: Pick<Transaction, 'type' | 'amount' | 'category' | 'customerId' | 'customerName'>) =>
    `${TYPE_LABELS[t.type]} ${money(t.amount)} · ${t.customerName ?? (t.customerId ? getCustomer(t.customerId)?.name : undefined) ?? CATEGORY_LABELS[t.category]}`

  // Savatchaga: bir xil yozuv ikki marta tushmaydi
  const toTrash = (entry: TrashEntry) => {
    setTrash((list) => [entry, ...pruneTrash(list).filter((e) => !(e.kind === entry.kind && e.id === entry.id))])
  }

  // Savatchadan qaytarish (toast'dagi "Bekor qilish" ham shuni chaqiradi — holat funksional yangilanadi)
  const restoreEntry = (entry: TrashEntry) => {
    setTrash((list) => list.filter((e) => !(e.kind === entry.kind && e.id === entry.id)))
    switch (entry.kind) {
      case 'customer':
        setCustomers((list) => (list.some((c) => c.id === entry.id) ? list : [entry.item, ...list]))
        audit('customer.restore', entry.item.name, entry.id)
        toast.success(`"${entry.item.name}" tiklandi`)
        break
      case 'transaction':
        setTransactions((list) => (list.some((t) => t.id === entry.id) ? list : [entry.item, ...list]))
        audit('payment.restore', txSummary(entry.item), entry.id)
        toast.success('Tranzaksiya tiklandi')
        break
      case 'course':
        setCourses((list) => {
          if (list.some((c) => c.id === entry.id)) return list
          // Shu nomli kurs keyin qo'shilgan bo'lsa — nomlar takrorlanmasligi uchun belgi qo'shiladi
          const taken = list.some((c) => c.name.toLowerCase() === entry.item.name.toLowerCase())
          return [...list, taken ? { ...entry.item, name: `${entry.item.name} (tiklangan)` } : entry.item]
        })
        audit('course.restore', entry.item.name, entry.id)
        toast.success(`"${entry.item.name}" tiklandi`)
        break
    }
  }

  const undo = (entry: TrashEntry) => ({ action: { label: 'Bekor qilish', onClick: () => restoreEntry(entry) } })

  const trashed = <K extends TrashKind>(kind: K, id: string, item: Extract<TrashEntry, { kind: K }>['item']) =>
    ({ kind, id, item, deletedAt: new Date().toISOString(), deletedBy: actor?.userName ?? '' }) as TrashEntry

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
      const required = SECTION_PERMISSION[section]
      if (required && !allowed(required)) return
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
    openModal: (next) => {
      if (allowed(modalPermission(next))) setModal(next)
    },
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
      if (!allowed('customers.edit')) return
      const createdAt = new Date().toISOString()
      const customer: Customer = { ...cleanCustomer(data), id: createId('c'), createdAt, ...(data.status === 'paid' ? { paidAt: createdAt } : {}) }
      setCustomers((list) => [customer, ...list])
      audit('customer.create', customer.name, customer.id)
      toast.success(`"${customer.name}" mijozlar bazasiga qo'shildi`)
    },
    updateCustomer: (id, patch) => {
      if (!allowed('customers.edit')) return
      const updatedAt = new Date().toISOString()
      setCustomers((list) => list.map((c) => (c.id === id ? withPaidAt(c, { ...c, ...cleanCustomer(patch), updatedAt }, updatedAt) : c)))
      const before = getCustomer(id)
      const name = before?.name ?? 'Mijoz'
      const keys = Object.keys(patch)
      if (keys.length === 1 && patch.status) {
        audit('customer.status', `${name}: ${before ? STATUS_LABELS[before.status] : '—'} → ${STATUS_LABELS[patch.status]}`, id)
        toast.success(`${name}: bosqich "${STATUS_LABELS[patch.status]}" ga o'zgartirildi`)
      } else {
        audit('customer.update', patch.name && patch.name.trim() !== name ? `${name} → ${patch.name.trim()}` : name, id)
        toast.success(`${name} ma'lumotlari saqlandi`)
      }
    },
    deleteCustomer: (id) => {
      if (!allowed('customers.delete')) return
      const customer = getCustomer(id)
      if (!customer) return
      const name = customer.name
      setCustomers((list) => list.filter((c) => c.id !== id))
      // Bog'liq to'lovlar jurnalda qoladi — ism snapshot'i o'chirish paytidagi holatga yangilanadi
      setTransactions((list) => list.map((t) => (t.customerId === id ? { ...t, customerName: name } : t)))
      const entry = trashed('customer', id, customer)
      toTrash(entry)
      audit('customer.delete', name, id)
      toast.success(`"${name}" savatchaga o'tkazildi`, undo(entry))
    },
    addTransaction: (data) => {
      if (!allowed(data.type === 'income' ? 'payments.create' : 'payments.manage')) return
      const created = { ...withCustomerName(cleanTransaction(data)), id: createId('t') }
      setTransactions((list) => [created, ...list])
      audit('payment.create', txSummary(created), created.id)
      toast.success(`${data.type === 'income' ? 'To\'lov' : 'Xarajat'} qayd etildi: ${money(data.amount)}`)
    },
    updateTransaction: (id, patch) => {
      if (!allowed('payments.manage')) return
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
      const before = transactions.find((t) => t.id === id)
      if (keys.every((k) => k === 'status' || k === 'date') && patch.status) {
        if (before) audit('payment.status', `${txSummary(before)}: ${TX_STATUS_LABELS[before.status]} → ${TX_STATUS_LABELS[patch.status]}`, id)
        toast.success(`Status: "${TX_STATUS_LABELS[patch.status]}"`)
      } else {
        if (before) audit('payment.update', txSummary({ ...before, ...clean }), id)
        toast.success('Tranzaksiya yangilandi')
      }
    },
    deleteTransaction: (id) => {
      if (!allowed('payments.manage')) return
      const transaction = transactions.find((t) => t.id === id)
      if (!transaction) return
      setTransactions((list) => list.filter((t) => t.id !== id))
      // Mijoz ismi snapshot'i bilan: mijoz keyin o'chirilsa ham savatchada kimniki ekani ko'rinadi
      const entry = trashed('transaction', id, withCustomerName(transaction))
      toTrash(entry)
      audit('payment.delete', txSummary(transaction), id)
      toast.success('Tranzaksiya savatchaga o\'tkazildi', undo(entry))
    },
    getCourse: (id) => (id ? courses.find((c) => c.id === id) : undefined),
    addCourse: (data) => {
      if (!allowed('courses.edit')) return
      const course: Course = { ...data, name: normalizeCourseName(data.name), id: createId('k'), createdAt: new Date().toISOString() }
      setCourses((list) => [...list, course])
      audit('course.create', course.name, course.id)
      toast.success(`"${course.name}" qo'shildi`)
    },
    updateCourse: (id, patch) => {
      if (!allowed('courses.edit')) return
      const before = courses.find((c) => c.id === id)
      if (!before) return
      const name = patch.name === undefined ? before.name : normalizeCourseName(patch.name)
      setCourses((list) => list.map((c) => (c.id === id ? { ...c, ...patch, name, updatedAt: new Date().toISOString() } : c)))
      if (name !== before.name) {
        setCustomers((list) => list.map((c) => (c.course === before.name ? { ...c, course: name } : c)))
      }
      const keys = Object.keys(patch)
      if (keys.length === 1 && patch.status) {
        audit(patch.status === 'archived' ? 'course.archive' : 'course.update', patch.status === 'archived' ? name : `${name}: arxivdan qaytarildi`, id)
        toast.success(patch.status === 'archived' ? `"${name}" arxivlandi` : `"${name}" arxivdan qaytarildi`)
      } else {
        audit('course.update', name !== before.name ? `${before.name} → ${name}` : name, id)
        toast.success(`"${name}" saqlandi`)
      }
    },
    removeCourse: (id) => {
      if (!allowed('courses.edit')) return
      const course = courses.find((c) => c.id === id)
      if (!course) return
      if (usedByCustomers(course, customers) > 0) {
        setCourses((list) => list.map((c) => (c.id === id ? { ...c, status: 'archived', updatedAt: new Date().toISOString() } : c)))
        audit('course.archive', course.name, id)
        toast.info(`"${course.name}" mijozlari bor — o'chirish o'rniga arxivlandi`)
        return
      }
      setCourses((list) => list.filter((c) => c.id !== id))
      const entry = trashed('course', id, course)
      toTrash(entry)
      audit('course.delete', course.name, id)
      toast.success(`"${course.name}" savatchaga o'tkazildi`, undo(entry))
    },
    updateSettings: (next, options) => {
      if (!allowed('settings.manage')) return
      setSettings(next)
      audit('settings.update', next.orgName)
      if (!options?.silent) toast.success('Sozlamalar saqlandi')
    },
    resetData: () => {
      if (!allowed('data.manage')) return
      const { data, saved } = resetToMock()
      applyData(data)
      setIsDemo(true)
      reportSave('all', saved)
      audit('data.reset', `${data.customers.length} mijoz, ${data.transactions.length} tranzaksiya`)
      if (saved.ok) toast.success('Demo ma\'lumotlar tiklandi')
    },
    clearAllData: () => {
      if (!allowed('data.manage')) return
      const empty = createEmptyData()
      setCustomers(empty.customers)
      setTransactions(empty.transactions)
      setCourses(empty.courses)
      setSearch('')
      setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
      setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
      setIsDemo(false)
      reportSave(STORAGE_KEYS.demo, setDemoMode(false))
      audit('data.clear', `${customers.length} mijoz, ${transactions.length} tranzaksiya, ${courses.length} kurs`)
      toast.success('Barcha ma\'lumot tozalandi')
    },
    clearDemoData: () => {
      if (!allowed('data.manage')) return
      setCustomers([])
      setTransactions([])
      setSearch('')
      setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
      setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
      setIsDemo(false)
      reportSave(STORAGE_KEYS.demo, setDemoMode(false))
      audit('data.clear', `Demo: ${customers.length} mijoz, ${transactions.length} tranzaksiya`)
      toast.success('Demo ma\'lumot tozalandi — endi o\'z ma\'lumotlaringizni kiritishingiz mumkin')
    },
    replaceData: (data) => {
      if (!allowed('data.manage')) return
      // Zaxiradan tiklangan ma'lumot foydalanuvchiniki hisoblanadi
      const saved = saveAll(data)
      applyData(data)
      setIsDemo(false)
      reportSave('all', combineResults([saved, setDemoMode(false)]))
      audit('data.import', `${data.customers.length} mijoz, ${data.transactions.length} tranzaksiya, ${data.courses.length} kurs`)
      if (saved.ok) toast.success(`Zaxira tiklandi: ${data.customers.length} mijoz, ${data.transactions.length} tranzaksiya`)
    },
    tourOpen,
    startTour: () => {
      setSection('overview')
      setSidebarOpen(false)
      setTourOpen(true)
    },
    endTour: () => {
      markTourDone(tourKey)
      setTourOpen(false)
    },
    trash,
    restoreFromTrash: (kind, id) => {
      if (!allowed('trash.manage')) return
      const entry = trash.find((e) => e.kind === kind && e.id === id)
      if (entry) restoreEntry(entry)
    },
    purgeFromTrash: (kind, id) => {
      if (!allowed('trash.manage')) return
      const entry = trash.find((e) => e.kind === kind && e.id === id)
      if (!entry) return
      setTrash((list) => list.filter((e) => e !== entry))
      audit('trash.purge', entry.kind === 'transaction' ? txSummary(entry.item) : entry.item.name, id)
      toast.success('Butunlay o\'chirildi')
    },
    emptyTrash: () => {
      if (!allowed('trash.manage') || trash.length === 0) return
      audit('trash.purge', `Savatcha tozalandi: ${trash.length} ta yozuv`)
      setTrash([])
      toast.success('Savatcha tozalandi')
    },
    logExport: (what, kind = 'export') => audit(kind === 'backup' ? 'data.backup' : 'data.export', what),
    money,
    formatDate: (iso) => formatDateWith(iso, settings.dateFormat),
    getCustomerName: (id) => resolveCustomerName(id, getCustomer(id), id ? snapshotNames.get(id) : undefined),
  }

  return <DashboardContext value={value}>{children}</DashboardContext>
}
