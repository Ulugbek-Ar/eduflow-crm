// Sotuv voronkasi bosqichlari (v5). Eski holatlar migratsiyada: lead -> new, active -> paid,
// paused -> thinking, left -> cancelled
export type CustomerStatus = 'new' | 'contacted' | 'thinking' | 'paid' | 'cancelled'

export type LegacyCustomerStatus = 'lead' | 'active' | 'paused' | 'left'

export type CustomerSource = 'telegram' | 'instagram' | 'website' | 'referral'

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  course: string
  status: CustomerStatus
  source: CustomerSource
  note?: string
  createdAt: string
  updatedAt?: string
  // v9: "To'lov qildi" bosqichiga o'tgan vaqt (faqat shu bosqichda). Faol mijozlar trendi va
  // kurs davomiyligi (qarz hisobi) shundan hisoblanadi
  paidAt?: string
}

export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'paidAt'>

export type CustomerSortKey = 'name' | 'course' | 'status' | 'createdAt'

export interface CustomerFilters {
  status: CustomerStatus | 'all'
  course: string
  source: CustomerSource | 'all'
  // Qo'shilgan sana oralig'i: 'YYYY-MM-DD' yoki bo'sh satr
  from: string
  to: string
}

export type CustomerView = 'table' | 'kanban'
