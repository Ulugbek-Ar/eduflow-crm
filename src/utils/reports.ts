import { CATEGORY_LABELS, METHOD_LABELS, SOURCE_LABELS, STATUS_LABELS, TYPE_LABELS } from '../constants/navigation'
import type { ExportColumn } from '../services/export.service'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'

export function customerColumns(formatDate: (iso: string) => string): ExportColumn<Customer>[] {
  return [
    { header: 'Ism', value: (c) => c.name, width: 160 },
    { header: 'Telefon', value: (c) => c.phone, width: 130 },
    { header: 'Email', value: (c) => c.email ?? '', width: 160 },
    { header: 'Kurs', value: (c) => c.course, width: 150 },
    { header: 'Holat', value: (c) => STATUS_LABELS[c.status], width: 90 },
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
    { header: 'To\'lov usuli', value: (t) => METHOD_LABELS[t.method], width: 110 },
    { header: 'Mijoz', value: (t) => (t.customerId ? getCustomerName(t.customerId) : ''), width: 160 },
    { header: 'Izoh', value: (t) => t.note, width: 220 },
  ]
}
