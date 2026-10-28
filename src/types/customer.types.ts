export type CustomerStatus = 'lead' | 'active' | 'paused' | 'left'

export type CustomerSource = 'telegram' | 'instagram' | 'website' | 'referral'

export interface Customer {
  id: string
  name: string
  phone: string
  course: string
  status: CustomerStatus
  source: CustomerSource
  createdAt: string
}

export type NewCustomer = Omit<Customer, 'id' | 'createdAt'>
