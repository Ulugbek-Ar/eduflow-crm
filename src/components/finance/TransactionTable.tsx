import { tr } from '../../i18n'
import { useState } from 'react'
import { CATEGORY_LABELS, categoriesFor, METHOD_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import type { SortDirection } from '../../types/dashboard.types'
import type { Transaction, TransactionCategory, TransactionFilters, TransactionSortKey, TransactionStatus } from '../../types/finance.types'
import { filterByPeriod } from '../../utils/analytics'
import { toOptions } from '../../utils/cx'
import { countActive, paginate } from '../../utils/list'
import {
  EMPTY_TRANSACTION_FILTERS,
  filterTransactions,
  hasTransactionFilters,
  sortTransactions,
  transactionPeriod,
} from '../../utils/transactions'
import { Badge } from '../ui/Badge'
import { FilterPanel } from '../ui/FilterPanel'
import type { BadgeTone } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { DateInput } from '../ui/DateInput'
import { Pagination } from '../ui/Pagination'
import { Select } from '../ui/Select'
import { SortHeader } from '../ui/SortHeader'
import { DebtsCard } from './DebtsCard'
import { FinanceBreakdowns, FinanceSummary } from './FinanceSummary'

// Status select rangi: badge klasslari bilan bir xil tokenlar
const STATUS_TONE: Record<TransactionStatus, string> = { paid: 'paid', pending: 'warning', cancelled: 'neutral' }

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as TransactionCategory[]

const MOBILE_SORTS = [
  { value: 'date:desc', label: tr('Eng yangi') },
  { value: 'date:asc', label: tr('Eng eski') },
  { value: 'amount:desc', label: tr('Summa: kattadan') },
  { value: 'amount:asc', label: tr('Summa: kichikdan') },
]

export function TransactionTable() {
  const {
    transactions,
    search,
    setSearch,
    dateRange,
    money,
    getCustomer,
    getCustomerName,
    deleteTransaction,
    updateTransaction,
    openModal,
    transactionFilters: filters,
    setTransactionFilters,
    transactionSort: sort,
    setTransactionSort,
    formatDate,
    settings,
  } = useDashboard()
  const confirm = useConfirm()
  const can = useCan()
  const canCreate = can('payments.create')
  const canManage = can('payments.manage')
  const [page, setPage] = useState(1)
  const [dateResetKey, setDateResetKey] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const viewKey = JSON.stringify([search, filters, sort, dateRange])
  const [prevViewKey, setPrevViewKey] = useState(viewKey)
  if (viewKey !== prevViewKey) {
    setPrevViewKey(viewKey)
    setPage(1)
  }

  const { period, label: periodLabel } = transactionPeriod(filters, dateRange)

  const inPeriod = filterByPeriod(transactions, (t) => t.date, period)
  const rows = sortTransactions(filterTransactions(transactions, filters, period, search, getCustomerName), sort)
  const current = paginate(rows, page, pageSize)
  const filtersActive = hasTransactionFilters(filters) || search.trim() !== ''

  const categoryOptions = (filters.type === 'all' ? ALL_CATEGORIES : categoriesFor(filters.type)).map((c) => ({
    value: c,
    label: CATEGORY_LABELS[c],
  }))

  const setFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
    const next = { ...filters, [key]: value }
    // Turi o'zgarsa, unga mos kelmaydigan kategoriya filtri olib tashlanadi
    if (key === 'type' && next.type !== 'all' && next.category !== 'all' && !categoriesFor(next.type).includes(next.category)) {
      next.category = 'all'
    }
    setTransactionFilters(next)
  }

  const clearFilters = () => {
    // Chala yozilgan sana matni ham tozalansin — sana maydonlari qayta yaratiladi
    setDateResetKey((k) => k + 1)
    setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
    setSearch('')
  }

  const handleDelete = async (t: Transaction) => {
    const ok = await confirm({
      title: tr('Tranzaksiyani o\'chirish'),
      message: tr('{0}: {1} ({2}) savatchaga o\'tkaziladi — 30 kun ichida tiklash mumkin. Davom etasizmi?', { 0: TYPE_LABELS[t.type], 1: money(t.amount), 2: formatDate(t.date) }),
      confirmLabel: tr('O\'chirish'),
    })
    if (ok) deleteTransaction(t.id)
  }

  return (
    <>
      <FinanceSummary transactions={inPeriod} periodLabel={periodLabel} />

      <section className="card" aria-labelledby="journal-title">
        <div className="card-head">
          <div>
            <h2 id="journal-title">{tr('Tranzaksiyalar jurnali')}</h2>
            <span className="muted">
              {rows.length} {tr('ta yozuv ·')} {periodLabel}
            </span>
          </div>
          <div className="toolbar">
            {canManage && (
              <Button variant="ghost" icon="minus" onClick={() => openModal({ type: 'transaction', payload: { kind: 'expense' } })}>
                {tr('Xarajat')}
              </Button>
            )}
            {canCreate && (
              <Button icon="plus" onClick={() => openModal({ type: 'transaction', payload: { kind: 'income' } })}>
                {tr('To\'lov qabul qilish')}
              </Button>
            )}
          </div>
        </div>

        <FilterPanel activeCount={countActive(filters, EMPTY_TRANSACTION_FILTERS)}>
          <Select
            label={tr('Turi')}
            hideLabel
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value as TransactionFilters['type'])}
            options={[{ value: 'all', label: tr('Barcha turlar') }, ...toOptions(TYPE_LABELS)]}
          />
          <Select
            label={tr('To\'lov turi')}
            hideLabel
            value={filters.method}
            onChange={(e) => setFilter('method', e.target.value as TransactionFilters['method'])}
            options={[{ value: 'all', label: tr('Barcha to\'lov turlari') }, ...toOptions(METHOD_LABELS)]}
          />
          <Select
            label={tr('Status')}
            hideLabel
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value as TransactionFilters['status'])}
            options={[{ value: 'all', label: tr('Barcha statuslar') }, ...toOptions(TX_STATUS_LABELS)]}
          />
          <Select
            label={tr('Kategoriya')}
            hideLabel
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value as TransactionFilters['category'])}
            options={[{ value: 'all', label: tr('Barcha kategoriyalar') }, ...categoryOptions]}
          />
          <div className="date-range">
            <DateInput key={`from-${dateResetKey}`} label={tr('Dan')} format={settings.dateFormat} value={filters.from} max={filters.to || undefined} onChange={(value) => setFilter('from', value)} />
            <DateInput key={`to-${dateResetKey}`} label={tr('Gacha')} format={settings.dateFormat} value={filters.to} min={filters.from || undefined} onChange={(value) => setFilter('to', value)} />
          </div>
          <Select
            label={tr('Saralash')}
            hideLabel
            className="mobile-only"
            value={`${sort.key}:${sort.direction}`}
            onChange={(e) => {
              const [key, direction] = e.target.value.split(':') as [TransactionSortKey, SortDirection]
              setTransactionSort({ key, direction })
            }}
            options={MOBILE_SORTS}
          />
          {filtersActive && (
            <Button variant="subtle" icon="close" onClick={clearFilters}>
              {tr('Filtrlarni tozalash')}
            </Button>
          )}
        </FilterPanel>

        {current.total === 0 ? (
          <EmptyState
            variant={transactions.length === 0 ? 'empty' : 'search'}
            title={transactions.length === 0 ? tr('Hali tranzaksiya yo\'q') : tr('Tranzaksiya topilmadi')}
            description={
              transactions.length === 0
                ? tr('Birinchi to\'lovni qayd eting — kassa balansi avtomatik hisoblanadi.')
                : tr('Davr yoki filtrlarni o\'zgartirib ko\'ring.')
            }
            action={
              transactions.length === 0 ? (
                canCreate && (
                <Button icon="plus" onClick={() => openModal({ type: 'transaction', payload: { kind: 'income' } })}>
                  {tr('To\'lov qo\'shish')}
                </Button>
                )
              ) : (
                filtersActive && (
                  <Button variant="ghost" icon="close" onClick={clearFilters}>
                    {tr('Filtrlarni tozalash')}
                  </Button>
                )
              )
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <SortHeader label={tr('Sana')} sortKey="date" sort={sort} onSort={setTransactionSort} />
                    <th scope="col">{tr('Mijoz')}</th>
                    <SortHeader label={tr('Summa')} sortKey="amount" sort={sort} onSort={setTransactionSort} align="right" />
                    <th scope="col">{tr('To\'lov turi')}</th>
                    <th scope="col">{tr('Status')}</th>
                    <th scope="col">
                      <span className="sr-only">{tr('Amallar')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((t) => (
                    <tr key={t.id}>
                      <td data-label={tr('Sana')} className="nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td data-label={tr('Mijoz')} className="cell-wide">
                        {t.customerId && !getCustomer(t.customerId) ? (
                          <span className="muted">{getCustomerName(t.customerId)}</span>
                        ) : t.customerId ? (
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => openModal({ type: 'customerDetail', payload: { id: t.customerId ?? '' } })}
                          >
                            {getCustomerName(t.customerId)}
                          </button>
                        ) : (
                          <span>{CATEGORY_LABELS[t.category]}</span>
                        )}
                        <small className="cell-sub">
                          {TYPE_LABELS[t.type]} · {t.customerId ? CATEGORY_LABELS[t.category] : t.note || '—'}
                          {t.customerId && t.note ? ` · ${t.note}` : ''}
                        </small>
                      </td>
                      <td data-label={tr('Summa')} className={`align-right nowrap strong ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                        <span className="sr-only">{TYPE_LABELS[t.type]}: </span>
                        {t.type === 'income' ? '+' : '−'}
                        {money(t.amount)}
                      </td>
                      <td data-label={tr('To\'lov turi')}>{METHOD_LABELS[t.method]}</td>
                      <td data-label={tr('Status')}>
                        {canManage ? (
                        <select
                          className={`status-select badge-${STATUS_TONE[t.status]}`}
                          value={t.status}
                          aria-label={tr('Status: {0} {1}, {2}', { 0: TYPE_LABELS[t.type], 1: money(t.amount), 2: formatDate(t.date) })}
                          onChange={(e) => updateTransaction(t.id, { status: e.target.value as TransactionStatus })}
                        >
                          {(Object.keys(TX_STATUS_LABELS) as TransactionStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {TX_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                        ) : (
                          <Badge tone={STATUS_TONE[t.status] as BadgeTone}>{TX_STATUS_LABELS[t.status]}</Badge>
                        )}
                      </td>
                      <td className="cell-actions">
                        <div className="row-actions">
                          {t.type === 'income' && (
                            <IconButton icon="receipt" label={tr('Chek')} onClick={() => openModal({ type: 'receipt', payload: { id: t.id } })} />
                          )}
                        {canManage && (
                        <>
                          <IconButton
                            icon="edit"
                            label={tr('Tranzaksiyani tahrirlash')}
                            onClick={() => openModal({ type: 'transaction', payload: { id: t.id } })}
                          />
                          <IconButton icon="trash" tone="danger" label={tr('Tranzaksiyani o\'chirish')} onClick={() => handleDelete(t)} />
                        </>
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              {...current}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </section>

      <DebtsCard />
      <FinanceBreakdowns transactions={inPeriod} />
    </>
  )
}
