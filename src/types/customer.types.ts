export type CustomerStatus = 'lead' | 'active' | 'paused' | 'left'

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
}

export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>

export type CustomerSortKey = 'name' | 'course' | 'status' | 'createdAt'

export interface CustomerFilters {
  status: CustomerStatus | 'all'
  course: string
  source: CustomerSource | 'all'
}
