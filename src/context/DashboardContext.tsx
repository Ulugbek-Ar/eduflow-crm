import { tr } from '../i18n'
import { useContext, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { sectionAllowed, sectionPermissions } from '../auth/permissions'
import type { Permission } from '../auth/permissions'
import { CATEGORY_LABELS, STATUS_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../constants/navigation'
import { AuthContext, useAuditActor, useCan } from '../hooks/useAuth'
import { logAudit } from '../services/audit.service'
import type { AuditAction } from '../services/audit.service'
import { isTourDone, markTourDone } from '../services/tour.service'
import { loadTrash, pruneTrash, saveTrash, TRASH_KEY, TRASH_KINDS } from '../services/trash.service'
import { createEduActions } from './eduActions'
import { teacherForUser } from '../utils/groups'
import { loadDemoData } from '../services/demo/load'
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
  LIST_KEYS,
  STORAGE_KEYS,
} from '../services/storage.service'
import type { ListKey, SaveResult, StoredData } from '../services/storage.service'
import type { CloudSnapshot, CloudSync } from '../data/supabase'
import type { Settings } from '../types/dashboard.types'
import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey } from '../types/customer.types'
import type { DateRange, ModalState, ModalType, Section, SortState } from '../types/dashboard.types'
import type { Transaction, TransactionFilters, TransactionInput, TransactionSortKey } from '../types/finance.types'
import type { Course } from '../types/course.types'
import { cashBalance } from '../utils/analytics'
import { courseInUse, normalizeCourseName } from '../utils/courses'
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

const DENIED_MESSAGE = tr('Bu amal uchun ruxsatingiz yo\'q. Administratorga murojaat qiling.')

// Oyna ochish uchun kerakli ruxsat
function modalPermission(modal: NonNullable<ModalState>): Permission {
  const byType: Record<ModalType, Permission> = {
    customer: 'customers.edit',
    customerDetail: 'customers.view',
    course: 'courses.edit',
    transaction: 'payments.create',
    receipt: 'payments.view',
  }
  if (modal.type === 'transaction' && (modal.payload?.id || modal.payload?.kind === 'expense')) return 'payments.manage'
  return byType[modal.type]
}

// Bulutli rejim: boshlang'ich ma'lumot serverdan, o'zgarishlar CloudSync orqali
export interface CloudBinding {
  initial: CloudSnapshot
  sync: CloudSync
}

export function DashboardProvider({ children, cloud }: { children: ReactNode; cloud?: CloudBinding }) {
  const toast = useToast()
  const confirm = useConfirm()
  const can = useCan()
  const actor = useAuditActor()
  const authMode = useContext(AuthContext)?.mode
  const authUser = useContext(AuthContext)?.user
  // AuthProvider bo'lmasa (alohida komponent testlari) — administrator kabi
  const role = authUser ? authUser.role : 'admin'
  // Demo markazda rol almashtirilsa ham tanishtiruv qayta chiqmaydi
  const tourKey = authMode === 'demo' ? 'demo' : (actor?.userId ?? 'local')
  const [tourOpen, setTourOpen] = useState(() => Boolean(actor) && !isTourDone(tourKey))
  const [initial] = useState(() => (cloud ? { data: cloud.initial.data, dropped: 0 } : loadData()))
  const [trash, setTrash] = useState(() => (cloud ? cloud.initial.trash : loadTrash()))
  // Saqlanmagan o'zgarishlar bayrog'i renderga ta'sir qilmaydi, shuning uchun ref
  const unsavedRef = useRef(false)
  const startupNoticeRef = useRef(false)
  const [saveMonitor] = useState(createSaveMonitor)
  const [customers, setCustomers] = useState(initial.data.customers)
  const [transactions, setTransactions] = useState(initial.data.transactions)
  const [settings, setSettings] = useState(initial.data.settings)
  const [courses, setCourses] = useState(initial.data.courses)
  const [teachers, setTeachers] = useState(initial.data.teachers)
  const [groups, setGroups] = useState(initial.data.groups)
  const [enrollments, setEnrollments] = useState(initial.data.enrollments)
  const [attendance, setAttendance] = useState(initial.data.attendance)
  const [lessonExceptions, setLessonExceptions] = useState(initial.data.lessonExceptions)
  const [isDemo, setIsDemo] = useState(() => !cloud && isDemoMode())
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
      toast.info(tr('{0} ta buzuq yozuv topildi va tashlab yuborildi', { 0: initial.dropped }))
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
  // Bulut: oxirgi muvaffaqiyatli yuborilgan holat va navbat (o'zgarishlar ketma-ket, faqat farqi yuboriladi).
  // Xato bo'lsa holat yangilanmaydi — keyingi o'zgarishda farq qayta yuboriladi
  const synced = useRef(initial.data)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const pushCloud = useEffectEvent(<K extends ListKey | 'settings'>(key: K, next: StoredData[K]) => {
    if (!cloud || synced.current[key] === next) return
    queue.current = queue.current.then(async () => {
      const prev = synced.current[key]
      try {
        if (key === 'settings') await cloud.sync.settings(next as Settings)
        else await cloud.sync.list(key as ListKey, prev as never, next as never)
        synced.current = { ...synced.current, [key]: next }
        onSaved(key, { ok: true })
      } catch {
        onSaved(key, { ok: false, reason: 'network' })
      }
    })
  })

  useEffect(() => (cloud ? pushCloud('customers', customers) : onSaved(STORAGE_KEYS.customers, setItem(STORAGE_KEYS.customers, customers))), [customers, cloud])
  useEffect(() => (cloud ? pushCloud('transactions', transactions) : onSaved(STORAGE_KEYS.transactions, setItem(STORAGE_KEYS.transactions, transactions))), [transactions, cloud])
  useEffect(() => (cloud ? pushCloud('settings', settings) : onSaved(STORAGE_KEYS.settings, setItem(STORAGE_KEYS.settings, settings))), [settings, cloud])
  useEffect(() => (cloud ? pushCloud('courses', courses) : onSaved(STORAGE_KEYS.courses, setItem(STORAGE_KEYS.courses, courses))), [courses, cloud])
  useEffect(() => (cloud ? pushCloud('teachers', teachers) : onSaved(STORAGE_KEYS.teachers, setItem(STORAGE_KEYS.teachers, teachers))), [teachers, cloud])
  useEffect(() => (cloud ? pushCloud('groups', groups) : onSaved(STORAGE_KEYS.groups, setItem(STORAGE_KEYS.groups, groups))), [groups, cloud])
  useEffect(() => (cloud ? pushCloud('enrollments', enrollments) : onSaved(STORAGE_KEYS.enrollments, setItem(STORAGE_KEYS.enrollments, enrollments))), [enrollments, cloud])
  useEffect(() => (cloud ? pushCloud('attendance', attendance) : onSaved(STORAGE_KEYS.attendance, setItem(STORAGE_KEYS.attendance, attendance))), [attendance, cloud])
  useEffect(
    () => (cloud ? pushCloud('lessonExceptions', lessonExceptions) : onSaved(STORAGE_KEYS.lessonExceptions, setItem(STORAGE_KEYS.lessonExceptions, lessonExceptions))),
    [lessonExceptions, cloud],
  )
  useEffect(() => {
    if (!cloud) onSaved(TRASH_KEY, saveTrash(trash))
  }, [trash, cloud])

  // Boshqa tabda o'zgargan ma'lumotni shu tabga olib kelish (storage event faqat boshqa tablarda chiqadi)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (cloud || event.storageArea !== localStorage) return
      // Demo rejimda kalitlar boshqa nom maydonida (eduflow-demo:*)
      const is = (key: string) => event.key === null || event.key === physicalKey(key)
      const watched = [...LIST_KEYS.map((key) => STORAGE_KEYS[key]), STORAGE_KEYS.settings, STORAGE_KEYS.demo, TRASH_KEY]
      if (!watched.some(is)) return
      if (is(TRASH_KEY)) setTrash(loadTrash())
      if (is(STORAGE_KEYS.demo)) setIsDemo(isDemoMode())
      const { data } = readStored()
      if (is(STORAGE_KEYS.customers)) setCustomers(data.customers)
      if (is(STORAGE_KEYS.transactions)) setTransactions(data.transactions)
      if (is(STORAGE_KEYS.settings)) setSettings(data.settings)
      if (is(STORAGE_KEYS.courses)) setCourses(data.courses)
      if (is(STORAGE_KEYS.teachers)) setTeachers(data.teachers)
      if (is(STORAGE_KEYS.groups)) setGroups(data.groups)
      if (is(STORAGE_KEYS.enrollments)) setEnrollments(data.enrollments)
      if (is(STORAGE_KEYS.attendance)) setAttendance(data.attendance)
      if (is(STORAGE_KEYS.lessonExceptions)) setLessonExceptions(data.lessonExceptions)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [cloud])

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
        toast.success(tr('"{0}" tiklandi', { 0: entry.item.name }))
        break
      case 'transaction':
        setTransactions((list) => (list.some((t) => t.id === entry.id) ? list : [entry.item, ...list]))
        audit('payment.restore', txSummary(entry.item), entry.id)
        toast.success(tr('Tranzaksiya tiklandi'))
        break
      case 'course':
        setCourses((list) => {
          if (list.some((c) => c.id === entry.id)) return list
          // Shu nomli kurs keyin qo'shilgan bo'lsa — nomlar takrorlanmasligi uchun belgi qo'shiladi
          const taken = list.some((c) => c.name.toLowerCase() === entry.item.name.toLowerCase())
          return [...list, taken ? { ...entry.item, name: `${entry.item.name} (tiklangan)` } : entry.item]
        })
        audit('course.restore', entry.item.name, entry.id)
        toast.success(tr('"{0}" tiklandi', { 0: entry.item.name }))
        break
      case 'teacher':
        setTeachers((list) => (list.some((t) => t.id === entry.id) ? list : [...list, entry.item]))
        audit('teacher.restore', entry.item.name, entry.id)
        toast.success(tr('"{0}" tiklandi', { 0: entry.item.name }))
        break
      case 'group':
        setGroups((list) => (list.some((g) => g.id === entry.id) ? list : [...list, entry.item]))
        audit('group.restore', entry.item.name, entry.id)
        toast.success(tr('"{0}" tiklandi', { 0: entry.item.name }))
        break
      case 'enrollment':
        setEnrollments((list) => (list.some((e) => e.id === entry.id) ? list : [...list, entry.item]))
        audit('enrollment.restore', entry.label ?? entry.id, entry.id)
        toast.success(tr('{0} guruhga qaytarildi', { 0: entry.label ?? '' }))
        break
    }
  }

  const undo = (entry: TrashEntry) => ({ action: { label: tr('Bekor qilish'), onClick: () => restoreEntry(entry) } })

  const trashed = <K extends TrashKind>(kind: K, id: string, item: Extract<TrashEntry, { kind: K }>['item']) =>
    ({ kind, id, item, deletedAt: new Date().toISOString(), deletedBy: actor?.userName ?? '' }) as TrashEntry

  // ===== O'qituvchi faqat o'z guruhlarini ko'radi; o'quvchilarning telefoni yashirin; to'lovlar — ruxsat bo'yicha =====
  const ownTeacher = role === 'teacher' ? teacherForUser(authUser?.id, teachers) : undefined
  const scoped = role === 'teacher'
  const visibleGroups = scoped ? groups.filter((g) => ownTeacher !== undefined && g.teacherId === ownTeacher.id) : groups
  const visibleGroupIds = new Set(visibleGroups.map((g) => g.id))
  const visibleEnrollments = scoped ? enrollments.filter((e) => visibleGroupIds.has(e.groupId)) : enrollments
  const studentIds = new Set(visibleEnrollments.map((e) => e.customerId))
  const visibleCustomers = scoped
    ? customers.filter((c) => studentIds.has(c.id)).map((c): Customer => ({ id: c.id, name: c.name, phone: '', course: c.course, status: c.status, source: c.source, createdAt: c.createdAt }))
    : customers
  const visibleTransactions = can('payments.view') ? transactions : []

  const edu = createEduActions({
    customers,
    courses,
    teachers,
    groups,
    enrollments,
    attendance,
    lessonExceptions,
    settings,
    setCustomers,
    setTeachers,
    setGroups,
    setEnrollments,
    setAttendance,
    setLessonExceptions,
    role,
    ownTeacherId: ownTeacher?.id,
    actorName: actor?.userName ?? '',
    can,
    allowed: (permission) => allowed(permission),
    audit: (action, summary, entityId) => audit(action, summary, entityId),
    toast,
    toTrash: (entry) => toTrash(entry),
    undo: (entry) => undo(entry),
  })

  const applyData = (data: StoredData) => {
    setCustomers(data.customers)
    setTransactions(data.transactions)
    setSettings(data.settings)
    setCourses(data.courses)
    setTeachers(data.teachers)
    setGroups(data.groups)
    setEnrollments(data.enrollments)
    setAttendance(data.attendance)
    setLessonExceptions(data.lessonExceptions)
    setSearch('')
    setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
    setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
  }

  const value: DashboardContextValue = {
    customers: visibleCustomers,
    transactions: visibleTransactions,
    settings,
    courses,
    teachers: scoped ? (ownTeacher ? [ownTeacher] : []) : teachers,
    groups: visibleGroups,
    enrollments: visibleEnrollments,
    attendance: scoped ? attendance.filter((r) => visibleGroupIds.has(r.groupId)) : attendance,
    lessonExceptions: scoped ? lessonExceptions.filter((e) => visibleGroupIds.has(e.groupId)) : lessonExceptions,
    ownTeacher,
    ...edu,
    getGroup: (id) => (id ? groups.find((g) => g.id === id) : undefined),
    getTeacher: (id) => (id ? teachers.find((t) => t.id === id) : undefined),
    exportData: () => ({ customers, transactions, courses, settings, teachers, groups, enrollments, attendance, lessonExceptions }),
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
      if (!sectionAllowed(role, section)) {
        const [required] = sectionPermissions(section)
        if (required) allowed(required)
        return
      }
      if (section === activeSection) {
        setSidebarOpen(false)
        return
      }
      if (unsavedRef.current) {
        const leave = await confirm({
          title: tr('Saqlanmagan o\'zgarishlar'),
          message: tr('Sozlamalarda saqlanmagan o\'zgarishlar bor. Chiqsangiz, ular yo\'qoladi.'),
          confirmLabel: tr('Saqlamasdan chiqish'),
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
      toast.success(tr('"{0}" mijozlar bazasiga qo\'shildi', { 0: customer.name }))
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
        toast.success(tr('{0}: bosqich "{1}" ga o\'zgartirildi', { 0: name, 1: STATUS_LABELS[patch.status] }))
      } else {
        audit('customer.update', patch.name && patch.name.trim() !== name ? `${name} → ${patch.name.trim()}` : name, id)
        toast.success(tr('{0} ma\'lumotlari saqlandi', { 0: name }))
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
      toast.success(tr('"{0}" savatchaga o\'tkazildi', { 0: name }), undo(entry))
    },
    addTransaction: (data) => {
      if (!allowed(data.type === 'income' ? 'payments.create' : 'payments.manage')) return
      const created = { ...withCustomerName(cleanTransaction(data)), id: createId('t') }
      setTransactions((list) => [created, ...list])
      audit('payment.create', txSummary(created), created.id)
      const receipt = created.type === 'income' ? { action: { label: tr('Chek'), onClick: () => setModal({ type: 'receipt', payload: { id: created.id } }) } } : undefined
      toast.success(tr('{0} qayd etildi: {1}', { 0: data.type === 'income' ? 'To\'lov' : 'Xarajat', 1: money(data.amount) }), receipt)
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
        toast.success(tr('Status: "{0}"', { 0: TX_STATUS_LABELS[patch.status] }))
      } else {
        if (before) audit('payment.update', txSummary({ ...before, ...clean }), id)
        toast.success(tr('Tranzaksiya yangilandi'))
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
      toast.success(tr('Tranzaksiya savatchaga o\'tkazildi'), undo(entry))
    },
    getCourse: (id) => (id ? courses.find((c) => c.id === id) : undefined),
    addCourse: (data) => {
      if (!allowed('courses.edit')) return
      const course: Course = { ...data, name: normalizeCourseName(data.name), id: createId('k'), createdAt: new Date().toISOString() }
      setCourses((list) => [...list, course])
      audit('course.create', course.name, course.id)
      toast.success(tr('"{0}" qo\'shildi', { 0: course.name }))
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
        toast.success(patch.status === 'archived' ? tr('"{0}" arxivlandi', { 0: name }) : tr('"{0}" arxivdan qaytarildi', { 0: name }))
      } else {
        audit('course.update', name !== before.name ? `${before.name} → ${name}` : name, id)
        toast.success(tr('"{0}" saqlandi', { 0: name }))
      }
    },
    removeCourse: (id) => {
      if (!allowed('courses.edit')) return
      const course = courses.find((c) => c.id === id)
      if (!course) return
      if (courseInUse(course, customers, groups)) {
        setCourses((list) => list.map((c) => (c.id === id ? { ...c, status: 'archived', updatedAt: new Date().toISOString() } : c)))
        audit('course.archive', course.name, id)
        toast.info(tr('"{0}" mijozlari bor — o\'chirish o\'rniga arxivlandi', { 0: course.name }))
        return
      }
      setCourses((list) => list.filter((c) => c.id !== id))
      const entry = trashed('course', id, course)
      toTrash(entry)
      audit('course.delete', course.name, id)
      toast.success(tr('"{0}" savatchaga o\'tkazildi', { 0: course.name }), undo(entry))
    },
    updateSettings: (next, options) => {
      if (!allowed('settings.manage')) return
      setSettings(next)
      audit('settings.update', next.orgName)
      if (!options?.silent) toast.success(tr('Sozlamalar saqlandi'))
    },
    resetData: () => {
      if (!allowed('data.manage')) return
      loadDemoData()
        .then((demo) => {
          const { data, saved } = resetToMock(demo)
          applyData(data)
          setIsDemo(true)
          reportSave('all', saved)
          audit('data.reset', `${data.customers.length} mijoz, ${data.transactions.length} tranzaksiya`)
          if (saved.ok) toast.success(tr('Demo ma\'lumotlar tiklandi'))
        })
        .catch(() => toast.error(tr('Demo yuklanmadi. Internetni tekshirib, qayta urinib ko\'ring.')))
    },
    clearAllData: () => {
      if (!allowed('data.manage')) return
      const empty = createEmptyData()
      setCustomers(empty.customers)
      setTransactions(empty.transactions)
      setCourses(empty.courses)
      setTeachers(empty.teachers)
      setGroups(empty.groups)
      setEnrollments(empty.enrollments)
      setAttendance(empty.attendance)
      setLessonExceptions(empty.lessonExceptions)
      setSearch('')
      setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
      setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
      setIsDemo(false)
      reportSave(STORAGE_KEYS.demo, setDemoMode(false))
      audit('data.clear', `${customers.length} mijoz, ${transactions.length} tranzaksiya, ${courses.length} kurs`)
      toast.success(tr('Barcha ma\'lumot tozalandi'))
    },
    clearDemoData: () => {
      if (!allowed('data.manage')) return
      setCustomers([])
      setTransactions([])
      setEnrollments([])
      setAttendance([])
      setLessonExceptions([])
      setSearch('')
      setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
      setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
      setIsDemo(false)
      reportSave(STORAGE_KEYS.demo, setDemoMode(false))
      audit('data.clear', `Demo: ${customers.length} mijoz, ${transactions.length} tranzaksiya`)
      toast.success(tr('Demo ma\'lumot tozalandi — endi o\'z ma\'lumotlaringizni kiritishingiz mumkin'))
    },
    replaceData: (data) => {
      if (!allowed('data.manage')) return
      // Zaxiradan tiklangan ma'lumot foydalanuvchiniki hisoblanadi
      const saved = saveAll(data)
      applyData(data)
      setIsDemo(false)
      reportSave('all', combineResults([saved, setDemoMode(false)]))
      audit('data.import', `${data.customers.length} mijoz, ${data.transactions.length} tranzaksiya, ${data.courses.length} kurs`)
      if (saved.ok) toast.success(tr('Zaxira tiklandi: {0} mijoz, {1} tranzaksiya', { 0: data.customers.length, 1: data.transactions.length }))
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
      cloud?.sync.purge(entry.kind, [entry.id]).catch(() => reportSave('trash', { ok: false, reason: 'network' }))
      audit('trash.purge', entry.kind === 'transaction' ? txSummary(entry.item) : entry.kind === 'enrollment' ? (entry.label ?? id) : entry.item.name, id)
      toast.success(tr('Butunlay o\'chirildi'))
    },
    emptyTrash: () => {
      if (!allowed('trash.manage') || trash.length === 0) return
      audit('trash.purge', `Savatcha tozalandi: ${trash.length} ta yozuv`)
      if (cloud) {
        for (const kind of TRASH_KINDS) {
          cloud.sync.purge(kind, trash.filter((e) => e.kind === kind).map((e) => e.id)).catch(() => reportSave('trash', { ok: false, reason: 'network' }))
        }
      }
      setTrash([])
      toast.success(tr('Savatcha tozalandi'))
    },
    logExport: (what, kind = 'export') => audit(kind === 'backup' ? 'data.backup' : 'data.export', what),
    money,
    formatDate: (iso) => formatDateWith(iso, settings.dateFormat),
    getCustomerName: (id) => resolveCustomerName(id, getCustomer(id), id ? snapshotNames.get(id) : undefined),
  }

  return <DashboardContext value={value}>{children}</DashboardContext>
}
