export type TransactionType = 'income' | 'expense'

export type PaymentMethod = 'payme' | 'click' | 'cash' | 'bank'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  method: PaymentMethod
  note: string
  customerId?: string
  date: string
}

export type NewTransaction = Omit<Transaction, 'id'>
