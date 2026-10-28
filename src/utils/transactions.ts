import type { SortState } from '../types/dashboard.types'
import type { Transaction, TransactionFilters, TransactionSortKey } from '../types/finance.types'
import { inPeriod } from './analytics'
import type { Period } from './analytics'
import { applyDirection } from './list'

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = { type: 'all', method: 'all', category: 'all', from: '', to: '' }

export function hasTransactionFilters(filters: TransactionFilters): boolean {
  return filters.type !== 'all' || filters.method !== 'all' || filters.category !== 'all' || filters.from !== '' || filters.to !== ''
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
