import type { TransactionType } from './finance.types'

export type Section =
  | 'overview'
  | 'customers'
  | 'groups'
  | 'schedule'
  | 'attendance'
  | 'finance'
  | 'courses'
  | 'teachers'
  | 'analytics'
  | 'admin'
  | 'settings'
  | 'help'

export type DateRange = 'today' | '7d' | 'month' | 'year'

export type Currency = 'UZS' | 'USD'

export type SortDirection = 'asc' | 'desc'

export interface SortState<K extends string> {
  key: K
  direction: SortDirection
}

export type ModalState =
  | { type: 'customer'; payload?: { id?: string } }
  | { type: 'customerDetail'; payload: { id: string } }
  | { type: 'transaction'; payload?: { id?: string; kind?: TransactionType; customerId?: string; amount?: number; enrollmentId?: string; period?: string } }
  | { type: 'course'; payload?: { id?: string } }
  | { type: 'receipt'; payload: { id: string } }
  | { type: 'group'; payload?: { id?: string } }
  | { type: 'groupDetail'; payload: { id: string; tab?: GroupTab } }
  | { type: 'teacher'; payload?: { id?: string } }
  | { type: 'import' }
  | null

export type GroupTab = 'students' | 'attendance' | 'payments'

export type ModalType = NonNullable<ModalState>['type']

export type DateFormat = 'dd.mm.yyyy' | 'dd/mm/yyyy' | 'yyyy-mm-dd'

export type CsvDelimiter = ';' | ','

export interface Settings {
  orgName: string
  logoText: string
  // Logotip rasmi (data URL, 200 KB gacha); '' — harfli logo ko'rsatiladi
  logoImage: string
  phone: string
  address: string
  currency: Currency
  dateFormat: DateFormat
  csvDelimiter: CsvDelimiter
  adminLogin: string
  // Header'dagi profil menyusi: to'liq ism (bo'sh bo'lsa login ko'rsatiladi) va lavozim
  profileName: string
  profileRole: string
  // v11: o'qituvchi davomatni necha kun orqagacha tahrirlay oladi (bugun + N kun)
  attendanceEditDays: number
  // v11: birinchi oy narxi kunlar bo'yicha (proporsional) hisoblansinmi
  prorateFirstMonth: boolean
  // v11: oylik to'lov muddati — oyning shu sanasigacha (undan keyin to'lanmagan summa qarz)
  paymentDueDay: number
  // v11: qarz eslatmasi shablonlari ({ism} {summa} {kurs} {guruh} {oy} {markaz} {telefon})
  reminderTemplateUz: string
  reminderTemplateRu: string
}
