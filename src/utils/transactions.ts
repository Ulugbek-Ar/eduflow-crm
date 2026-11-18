import { tr } from '../i18n'
import { DATE_RANGE_LABELS } from '../constants/navigation'
import type { DateRange, SortState } from '../types/dashboard.types'
import type { Transaction, TransactionFilters, TransactionSortKey } from '../types/finance.types'
import { customPeriod, getPeriod, inPeriod } from './analytics'
import type { Period } from './analytics'
import { applyDirection } from './list'

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = { type: 'all', method: 'all', status: 'all', category: 'all', from: '', to: '' }

export function hasTransactionFilters(filters: TransactionFilters): boolean {
  return (
    filters.type !== 'all' ||
    filters.method !== 'all' ||
    filters.status !== 'all' ||
    filters.category !== 'all' ||
    filters.from !== '' ||
    filters.to !== ''
  )
}

// Sana oralig'i tanlansa u ishlatiladi, aks holda Header'dagi davr
export function transactionPeriod(filters: TransactionFilters, dateRange: DateRange): { period: Period; label: string } {
  const custom = customPeriod(filters.from, filters.to)
  return custom
    ? { period: custom, label: tr('tanlangan oraliq') }
    : { period: getPeriod(dateRange), label: DATE_RANGE_LABELS[dateRange].toLowerCase() }
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
  period: Period,
  search: string,
  getCustomerName: (id?: string) => string,
): Transaction[] {
  const query = search.trim().toLowerCase()
  return transactions.filter(
    (t) =>
      inPeriod(t.date, period) &&
      (filters.type === 'all' || t.type === filters.type) &&
      (filters.method === 'all' || t.method === filters.method) &&
      (filters.status === 'all' || t.status === filters.status) &&
      (filters.category === 'all' || t.category === filters.category) &&
      (!query || t.note.toLowerCase().includes(query) || getCustomerName(t.customerId).toLowerCase().includes(query)),
  )
}

export function sortTransactions(transactions: readonly Transaction[], sort: SortState<TransactionSortKey>): Transaction[] {
  return [...transactions].sort((a, b) => {
    const result = sort.key === 'amount' ? a.amount - b.amount : a.date.localeCompare(b.date)
    return applyDirection(result, sort.direction)
  })
}

export type TransactionFormErrors = Partial<Record<'amount' | 'date', string>>

// Bulut: server yozgan kirimlar (Payme/Click) ro'yxatga qo'shiladi yoki yangilanadi (o'zgargani — updatedAt bo'yicha).
// O'zgarish bo'lmasa — o'sha massiv qaytadi
export function mergeRemote(list: readonly Transaction[], remote: readonly Transaction[]): Transaction[] {
  if (remote.length === 0) return list as Transaction[]
  const incoming = new Map(remote.map((t) => [t.id, t]))
  let changed = false
  const updated = list.map((t) => {
    const next = incoming.get(t.id)
    if (!next) return t
    incoming.delete(t.id)
    if (next.updatedAt === t.updatedAt && next.status === t.status) return t
    changed = true
    return next
  })
  const added = [...incoming.values()]
  if (!changed && added.length === 0) return list as Transaction[]
  return [...added.sort((a, b) => b.date.localeCompare(a.date)), ...updated]
}
