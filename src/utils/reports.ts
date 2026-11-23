import { tr } from '../i18n'
import { CATEGORY_LABELS, METHOD_LABELS, SOURCE_LABELS, STATUS_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../constants/navigation'
import { ROLE_LABELS } from '../auth/permissions'
import { AUDIT_ACTION_LABELS, AUDIT_CATEGORY_LABELS, actionCategory } from '../services/audit.service'
import type { AuditEntry } from '../services/audit.service'
import type { ExportColumn } from '../services/export.service'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { SourcePerformance } from './analytics'
import type { DebtRow } from './debts'

export function customerColumns(formatDate: (iso: string) => string): ExportColumn<Customer>[] {
  return [
    { header: tr('Ism'), value: (c) => c.name, width: 160 },
    { header: tr('Telefon'), value: (c) => c.phone, width: 130 },
    { header: tr('Email'), value: (c) => c.email ?? '', width: 160 },
    { header: tr('Kurs'), value: (c) => c.course, width: 150 },
    { header: tr('Bosqich'), value: (c) => STATUS_LABELS[c.status], width: 100 },
    { header: tr('Manba'), value: (c) => SOURCE_LABELS[c.source], width: 90 },
    { header: tr('Qo\'shilgan sana'), value: (c) => formatDate(c.createdAt), width: 100 },
    { header: tr('Izoh'), value: (c) => c.note ?? '', width: 200 },
  ]
}

export function transactionColumns(
  formatDate: (iso: string) => string,
  getCustomerName: (id?: string) => string,
): ExportColumn<Transaction>[] {
  return [
    { header: tr('Sana'), value: (t) => formatDate(t.date), width: 90 },
    { header: tr('Turi'), value: (t) => TYPE_LABELS[t.type], width: 70 },
    { header: tr('Kategoriya'), value: (t) => CATEGORY_LABELS[t.category], width: 130 },
    { header: tr('Summa'), value: (t) => (t.type === 'income' ? t.amount : -t.amount), type: 'number', width: 100 },
    { header: tr('To\'lov turi'), value: (t) => METHOD_LABELS[t.method], width: 90 },
    { header: tr('Status'), value: (t) => TX_STATUS_LABELS[t.status], width: 100 },
    { header: tr('Manba'), value: (t) => (t.source ? SOURCE_LABELS[t.source] : ''), width: 90 },
    { header: tr('Mijoz'), value: (t) => (t.customerId ? getCustomerName(t.customerId) : ''), width: 160 },
    { header: tr('Izoh'), value: (t) => t.note, width: 220 },
  ]
}

export function debtColumns(): ExportColumn<DebtRow>[] {
  return [
    { header: tr('Mijoz'), value: (r) => r.customer.name, width: 160 },
    { header: tr('Telefon'), value: (r) => r.customer.phone, width: 130 },
    { header: tr('Guruh'), value: (r) => r.label, width: 170 },
    { header: tr('Oylik'), value: (r) => r.monthly, type: 'number', width: 100 },
    { header: tr('Kutilgan (jami)'), value: (r) => r.expected, type: 'number', width: 110 },
    { header: tr('To\'langan (jami)'), value: (r) => r.paid, type: 'number', width: 110 },
    { header: tr('Qarz'), value: (r) => r.debt, type: 'number', width: 100 },
    { header: tr('Kutilmoqda'), value: (r) => r.pending, type: 'number', width: 100 },
  ]
}

// Bo'sh qiymat ("—") eksportda bo'sh katak bo'lib chiqadi — Excel'da raqam ustuni buzilmaydi
const optionalNumber = (value: number | null) => (value === null ? '' : Math.round(value * 10) / 10)

export function sourceColumns(): ExportColumn<SourcePerformance>[] {
  return [
    { header: tr('Manba'), value: (r) => SOURCE_LABELS[r.source], width: 100 },
    { header: tr('Lidlar'), value: (r) => r.leads, type: 'number', width: 70 },
    { header: tr('To\'lov qildi'), value: (r) => r.paid, type: 'number', width: 80 },
    { header: tr('Konversiya, %'), value: (r) => optionalNumber(r.conversion), type: 'number', width: 90 },
    { header: tr('Marketing chiqimi'), value: (r) => r.spend, type: 'number', width: 110 },
    { header: tr('CPL'), value: (r) => optionalNumber(r.cpl === null ? null : Math.round(r.cpl)), type: 'number', width: 90 },
    { header: tr('Kirim'), value: (r) => r.revenue, type: 'number', width: 110 },
    { header: tr('ROI, %'), value: (r) => optionalNumber(r.roi), type: 'number', width: 80 },
  ]
}

export function auditColumns(formatDateTime: (iso: string) => string): ExportColumn<AuditEntry>[] {
  return [
    { header: tr('Vaqt'), value: (e) => formatDateTime(e.at), width: 120 },
    { header: tr('Xodim'), value: (e) => e.userName, width: 150 },
    { header: tr('Rol'), value: (e) => (e.role ? ROLE_LABELS[e.role] : ''), width: 110 },
    { header: tr('Bo\'lim'), value: (e) => AUDIT_CATEGORY_LABELS[actionCategory(e.action)], width: 120 },
    { header: tr('Amal'), value: (e) => AUDIT_ACTION_LABELS[e.action], width: 170 },
    { header: tr('Tafsilot'), value: (e) => e.summary, width: 280 },
  ]
}
