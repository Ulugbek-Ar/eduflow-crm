import type { AuditEntry } from '../services/audit.service'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { customerDebt } from './debts'

// Qog'oz: A4 yoki 80 mm termoprinter lentasi
export type PaperSize = 'a4' | 'thermal'

export const isPaperSize = (value: unknown): value is PaperSize => value === 'a4' || value === 'thermal'

export interface ReceiptData {
  transaction: Transaction
  customer?: Customer
  customerName: string
  cashier: string
  // To'lovdan keyin qolgan qarz (bo'lsa)
  remainingDebt: number
}

// Chek raqami: sana + id oxiri — o'zgarmaydi va takrorlanmaydi
export function receiptNumber(t: Pick<Transaction, 'id' | 'date'>): string {
  const d = new Date(t.date)
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `${stamp}-${t.id.slice(-4).toUpperCase()}`
}

// Kim qabul qilgani — jurnaldagi "To'lov yozildi" yozuvidan (tranzaksiyaning o'zida saqlanmaydi)
export function receiptCashier(transactionId: string, audit: readonly AuditEntry[]): string {
  return audit.find((e) => e.action === 'payment.create' && e.entityId === transactionId)?.userName ?? ''
}

export function buildReceipt(
  transaction: Transaction,
  customers: readonly Customer[],
  courses: readonly Course[],
  transactions: readonly Transaction[],
  audit: readonly AuditEntry[],
  customerName: string,
): ReceiptData {
  const customer = transaction.customerId ? customers.find((c) => c.id === transaction.customerId) : undefined
  const debt = customer ? customerDebt(customer, courses, transactions) : null
  return {
    transaction,
    customer,
    customerName,
    cashier: receiptCashier(transaction.id, audit),
    remainingDebt: debt?.debt ?? 0,
  }
}
