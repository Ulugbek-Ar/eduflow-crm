import { createContext, useContext } from 'react'
import type { Course, CourseInput } from '../types/course.types'
import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey } from '../types/customer.types'
import type { DateRange, ModalState, Section, Settings, SortState } from '../types/dashboard.types'
import type { StoredData } from '../services/storage.service'
import type { TrashEntry, TrashKind } from '../services/trash.service'
import type { Transaction, TransactionFilters, TransactionInput, TransactionSortKey } from '../types/finance.types'
import type { AttendanceRecord, LessonException } from '../types/attendance.types'
import type { Enrollment, Group } from '../types/group.types'
import type { Teacher } from '../types/teacher.types'
import type { Branch, BranchInput } from '../types/branch.types'
import type { EduActions } from './eduActions'
import type { DebtContext } from '../utils/debts'
import type { ImportPlan, ImportReceipt } from '../utils/import/customers'

// Guruh/o'qish/o'qituvchi/davomat amallari — context/eduActions.ts
export interface DashboardContextValue extends EduActions {
  // O'qituvchi rolida: faqat o'z guruhlaridagi o'quvchilar (telefonsiz); to'lovlar — payments.view bo'lsa
  customers: Customer[]
  transactions: Transaction[]
  settings: Settings
  courses: Course[]
  teachers: Teacher[]
  groups: Group[]
  enrollments: Enrollment[]
  attendance: AttendanceRecord[]
  lessonExceptions: LessonException[]
  // O'qituvchi sifatida kirgan bo'lsa — uning yozuvi
  ownTeacher: Teacher | undefined
  // v12: filiallar (filialga cheklangan xodimga — faqat o'zi). Yuqoridagi ro'yxatlar tanlangan filial bo'yicha
  branches: Branch[]
  // Tanlangan filial id'si ('' — barcha filiallar); cheklangan xodimda — doim o'z filiali
  branchFilter: string
  // Xodim shu filialga cheklangan (Header'da tanlov o'rniga filial nomi)
  restrictedBranch: string | undefined
  setBranchFilter: (id: string) => void
  getBranch: (id?: string) => Branch | undefined
  // assignExisting — birinchi filial: mavjud guruh, o'quvchi va to'lovlar shu filialga biriktiriladi. Natija — yangi id
  addBranch: (input: BranchInput, options?: { assignExisting?: boolean }) => string | null
  updateBranch: (id: string, patch: Partial<BranchInput>) => void
  // Ishlatilgan filial o'chirilmaydi — arxivlanadi
  removeBranch: (id: string) => void
  getGroup: (id?: string) => Group | undefined
  getTeacher: (id?: string) => Teacher | undefined
  // To'liq ma'lumot (JSON zaxira uchun; rol bo'yicha filtrsiz)
  exportData: () => StoredData
  // Qarz hisobi uchun (utils/debts.ts): guruhlar, o'qishlar, to'lov muddati va birinchi oy qoidasi
  debtContext: DebtContext
  // "Eslatildi": har mijoz uchun jurnalga yozuv (qarzdorlar ro'yxatida "Oxirgi eslatma")
  logReminders: (customerIds: readonly string[], channel: string) => void
  // Excel/CSV import: bitta jurnal yozuvi; bekor qilish — yaratilganlar o'chadi, yangilanganlar avvalgi holiga qaytadi
  importCustomers: (plan: ImportPlan) => ImportReceipt | null
  undoImport: (receipt: ImportReceipt) => void
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
  // Qisqa tanishtiruv (birinchi kirishda yoki Yordam bo'limidan)
  tourOpen: boolean
  startTour: () => void
  endTour: () => void
  // Savatcha: o'chirilgan yozuvlar 30 kun saqlanadi
  trash: TrashEntry[]
  restoreFromTrash: (kind: TrashKind, id: string) => void
  purgeFromTrash: (kind: TrashKind, id: string) => void
  emptyTrash: () => void
  // Hisobot yoki zaxira yuklab olinganini jurnalga yozish
  logExport: (what: string, kind?: 'export' | 'backup') => void
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
