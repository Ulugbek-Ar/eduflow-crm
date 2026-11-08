export type TransactionType = 'income' | 'expense'

import type { CustomerSource } from './customer.types'

// To'lov turi (v7). Eski qiymatlar migratsiyada: payme, click -> card; bank -> transfer; cash -> cash
export type PaymentMethod = 'cash' | 'card' | 'transfer'

export type LegacyPaymentMethod = 'payme' | 'click' | 'bank'

// Balans, KPI va hisobotlar faqat 'paid' bo'yicha hisoblanadi; eski yozuvlar migratsiyada 'paid'
export type TransactionStatus = 'paid' | 'pending' | 'cancelled'

export type IncomeCategory = 'course_fee' | 'other_income'

export type ExpenseCategory = 'rent' | 'salary' | 'marketing' | 'equipment' | 'utilities' | 'other_expense'

export type TransactionCategory = IncomeCategory | ExpenseCategory

export type PaymentProvider = 'payme' | 'click'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  method: PaymentMethod
  category: TransactionCategory
  note: string
  customerId?: string
  // Mijoz nomi snapshot'i: to'lov yaratilganda yoki mijoz o'chirilganda yoziladi,
  // mijoz o'chirilgandan keyin ham jurnalda kimning to'lovi ekani ko'rinib turadi
  customerName?: string
  status: TransactionStatus
  // Faqat marketing chiqimi uchun: qaysi manbaga sarflangan (CPL / ROI hisobi)
  source?: CustomerSource
  // v11: kurs to'lovi qaysi guruhdagi o'qish uchun (qarz va o'qituvchi maoshi hisobi)
  enrollmentId?: string
  // v11: maosh xarajati qaysi o'qituvchiga
  teacherId?: string
  // v11: qaysi oy uchun ('YYYY-MM'): to'lov chekida va maosh hisobotida
  period?: string
  // v1.2: onlayn to'lov tizimi orqali avtomatik yozilgan kirim (Payme / Click) va uning tranzaksiya id'si
  provider?: PaymentProvider
  providerRef?: string
  date: string
  updatedAt?: string
}

export type TransactionInput = Omit<Transaction, 'id' | 'updatedAt'>

export type TransactionSortKey = 'date' | 'amount'

export interface TransactionFilters {
  type: TransactionType | 'all'
  method: PaymentMethod | 'all'
  status: TransactionStatus | 'all'
  category: TransactionCategory | 'all'
  // 'YYYY-MM-DD' yoki bo'sh satr
  from: string
  to: string
}
