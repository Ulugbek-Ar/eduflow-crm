import { CATEGORY_LABELS, METHOD_LABELS, SOURCE_LABELS, STATUS_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../constants/navigation'
import type { ExportColumn } from '../services/export.service'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { SourcePerformance } from './analytics'
import type { DebtRow } from './debts'

export function customerColumns(formatDate: (iso: string) => string): ExportColumn<Customer>[] {
  return [
    { header: 'Ism', value: (c) => c.name, width: 160 },
    { header: 'Telefon', value: (c) => c.phone, width: 130 },
    { header: 'Email', value: (c) => c.email ?? '', width: 160 },
    { header: 'Kurs', value: (c) => c.course, width: 150 },
    { header: 'Bosqich', value: (c) => STATUS_LABELS[c.status], width: 100 },
    { header: 'Manba', value: (c) => SOURCE_LABELS[c.source], width: 90 },
    { header: 'Qo\'shilgan sana', value: (c) => formatDate(c.createdAt), width: 100 },
    { header: 'Izoh', value: (c) => c.note ?? '', width: 200 },
  ]
}

export function transactionColumns(
  formatDate: (iso: string) => string,
  getCustomerName: (id?: string) => string,
): ExportColumn<Transaction>[] {
  return [
    { header: 'Sana', value: (t) => formatDate(t.date), width: 90 },
    { header: 'Turi', value: (t) => TYPE_LABELS[t.type], width: 70 },
    { header: 'Kategoriya', value: (t) => CATEGORY_LABELS[t.category], width: 130 },
    { header: 'Summa', value: (t) => (t.type === 'income' ? t.amount : -t.amount), type: 'number', width: 100 },
    { header: 'To\'lov turi', value: (t) => METHOD_LABELS[t.method], width: 90 },
    { header: 'Status', value: (t) => TX_STATUS_LABELS[t.status], width: 100 },
    { header: 'Manba', value: (t) => (t.source ? SOURCE_LABELS[t.source] : ''), width: 90 },
    { header: 'Mijoz', value: (t) => (t.customerId ? getCustomerName(t.customerId) : ''), width: 160 },
    { header: 'Izoh', value: (t) => t.note, width: 220 },
  ]
}

export function debtColumns(): ExportColumn<DebtRow>[] {
  return [
    { header: 'Mijoz', value: (r) => r.customer.name, width: 160 },
    { header: 'Telefon', value: (r) => r.customer.phone, width: 130 },
    { header: 'Kurs', value: (r) => r.course.name, width: 150 },
    { header: 'Kutilgan', value: (r) => r.expected, type: 'number', width: 100 },
    { header: 'To\'langan', value: (r) => r.paid, type: 'number', width: 100 },
    { header: 'Qarz', value: (r) => r.debt, type: 'number', width: 100 },
    { header: 'Kutilmoqda', value: (r) => r.pending, type: 'number', width: 100 },
  ]
}

// Bo'sh qiymat ("—") eksportda bo'sh katak bo'lib chiqadi — Excel'da raqam ustuni buzilmaydi
const optionalNumber = (value: number | null) => (value === null ? '' : Math.round(value * 10) / 10)

export function sourceColumns(): ExportColumn<SourcePerformance>[] {
  return [
    { header: 'Manba', value: (r) => SOURCE_LABELS[r.source], width: 100 },
    { header: 'Lidlar', value: (r) => r.leads, type: 'number', width: 70 },
    { header: 'To\'lov qildi', value: (r) => r.paid, type: 'number', width: 80 },
    { header: 'Konversiya, %', value: (r) => optionalNumber(r.conversion), type: 'number', width: 90 },
    { header: 'Marketing chiqimi', value: (r) => r.spend, type: 'number', width: 110 },
    { header: 'CPL', value: (r) => optionalNumber(r.cpl === null ? null : Math.round(r.cpl)), type: 'number', width: 90 },
    { header: 'Kirim', value: (r) => r.revenue, type: 'number', width: 110 },
    { header: 'ROI, %', value: (r) => optionalNumber(r.roi), type: 'number', width: 80 },
  ]
}
