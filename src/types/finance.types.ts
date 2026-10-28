export type TransactionType = 'income' | 'expense'

export type PaymentMethod = 'payme' | 'click' | 'cash' | 'bank'

export type IncomeCategory = 'course_fee' | 'other_income'

export type ExpenseCategory = 'rent' | 'salary' | 'marketing' | 'equipment' | 'utilities' | 'other_expense'

export type TransactionCategory = IncomeCategory | ExpenseCategory

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  method: PaymentMethod
  category: TransactionCategory
  note: string
  customerId?: string
  date: string
  updatedAt?: string
}

export type TransactionInput = Omit<Transaction, 'id' | 'updatedAt'>

export type TransactionSortKey = 'date' | 'amount'

export interface TransactionFilters {
  type: TransactionType | 'all'
  method: PaymentMethod | 'all'
  category: TransactionCategory | 'all'
  // 'YYYY-MM-DD' yoki bo'sh satr
  from: string
  to: string
}
