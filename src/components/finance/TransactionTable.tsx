import { useState } from 'react'
import { CATEGORY_LABELS, categoriesFor, DATE_RANGE_LABELS, METHOD_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useConfirm } from '../../hooks/useConfirm'
import type { Transaction, TransactionCategory, TransactionFilters } from '../../types/finance.types'
import { customPeriod, filterByPeriod, getPeriod } from '../../utils/analytics'
import { toOptions } from '../../utils/cx'
import { formatDate } from '../../utils/format'
import { paginate } from '../../utils/list'
import { EMPTY_TRANSACTION_FILTERS, filterTransactions, hasTransactionFilters, sortTransactions } from '../../utils/transactions'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Pagination } from '../ui/Pagination'
import { Select } from '../ui/Select'
import { SortHeader } from '../ui/SortHeader'
import { FinanceSummary } from './FinanceSummary'

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as TransactionCategory[]

export function TransactionTable() {
  const {
    transactions,
    search,
    setSearch,
    dateRange,
    money,
    getCustomerName,
    deleteTransaction,
    openModal,
    transactionFilters: filters,
    setTransactionFilters,
    transactionSort: sort,
    setTransactionSort,
  } = useDashboard()
  const confirm = useConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const viewKey = JSON.stringify([search, filters, sort, dateRange])
  const [prevViewKey, setPrevViewKey] = useState(viewKey)
  if (viewKey !== prevViewKey) {
    setPrevViewKey(viewKey)
    setPage(1)
  }

  // Sana oralig'i tanlansa u ishlatiladi, aks holda Header'dagi davr
  const custom = customPeriod(filters.from, filters.to)
  const period = custom ?? getPeriod(dateRange)
  const periodLabel = custom ? 'tanlangan oraliq' : DATE_RANGE_LABELS[dateRange].toLowerCase()

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
    setTransactionFilters(EMPTY_TRANSACTION_FILTERS)
    setSearch('')
  }

  const handleDelete = async (t: Transaction) => {
    const ok = await confirm({
      title: 'Tranzaksiyani o\'chirish',
      message: `${TYPE_LABELS[t.type]}: ${money(t.amount)} (${formatDate(t.date)}) jurnaldan butunlay o'chiriladi. Davom etasizmi?`,
      confirmLabel: 'O\'chirish',
    })
    if (ok) deleteTransaction(t.id)
  }

  return (
    <>
      <FinanceSummary transactions={inPeriod} periodLabel={periodLabel} />

      <section className="card" aria-labelledby="journal-title">
        <div className="card-head">
          <div>
            <h2 id="journal-title">Tranzaksiyalar jurnali</h2>
            <span className="muted">
              {rows.length} ta yozuv · {periodLabel}
            </span>
          </div>
          <div className="toolbar">
            <Button variant="ghost" icon="minus" onClick={() => openModal({ type: 'transaction', payload: { kind: 'expense' } })}>
              Xarajat
            </Button>
            <Button icon="plus" onClick={() => openModal({ type: 'transaction', payload: { kind: 'income' } })}>
              To'lov qabul qilish
            </Button>
          </div>
        </div>

        <div className="filters">
          <Select
            label="Turi"
            hideLabel
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value as TransactionFilters['type'])}
            options={[{ value: 'all', label: 'Barcha turlar' }, ...toOptions(TYPE_LABELS)]}
          />
          <Select
            label="To'lov usuli"
            hideLabel
            value={filters.method}
            onChange={(e) => setFilter('method', e.target.value as TransactionFilters['method'])}
            options={[{ value: 'all', label: 'Barcha usullar' }, ...toOptions(METHOD_LABELS)]}
          />
          <Select
            label="Kategoriya"
            hideLabel
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value as TransactionFilters['category'])}
            options={[{ value: 'all', label: 'Barcha kategoriyalar' }, ...categoryOptions]}
          />
          <div className="date-range">
            <Input
              label="Dan"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => setFilter('from', e.target.value)}
            />
            <Input label="Gacha" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
          {filtersActive && (
            <Button variant="subtle" icon="close" onClick={clearFilters}>
              Filtrlarni tozalash
            </Button>
          )}
        </div>

        {current.total === 0 ? (
          <EmptyState
            variant={transactions.length === 0 ? 'empty' : 'search'}
            title={transactions.length === 0 ? 'Hali tranzaksiya yo\'q' : 'Tranzaksiya topilmadi'}
            description={
              transactions.length === 0
                ? 'Birinchi to\'lovni qayd eting — kassa balansi avtomatik hisoblanadi.'
                : 'Davr yoki filtrlarni o\'zgartirib ko\'ring.'
            }
            action={
              transactions.length === 0 ? (
                <Button icon="plus" onClick={() => openModal({ type: 'transaction', payload: { kind: 'income' } })}>
                  To'lov qo'shish
                </Button>
              ) : (
                filtersActive && (
                  <Button variant="ghost" icon="close" onClick={clearFilters}>
                    Filtrlarni tozalash
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
                    <SortHeader label="Sana" sortKey="date" sort={sort} onSort={setTransactionSort} />
                    <th scope="col">Turi</th>
                    <th scope="col">Kategoriya</th>
                    <th scope="col">Izoh</th>
                    <th scope="col">Mijoz</th>
                    <th scope="col">Usul</th>
                    <SortHeader label="Summa" sortKey="amount" sort={sort} onSort={setTransactionSort} align="right" />
                    <th scope="col">
                      <span className="sr-only">Amallar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((t) => (
                    <tr key={t.id}>
                      <td data-label="Sana" className="nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td data-label="Turi">
                        <Badge tone={t.type}>{TYPE_LABELS[t.type]}</Badge>
                      </td>
                      <td data-label="Kategoriya">{CATEGORY_LABELS[t.category]}</td>
                      <td data-label="Izoh">{t.note || '—'}</td>
                      <td data-label="Mijoz">
                        {t.customerId ? (
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => openModal({ type: 'customerDetail', payload: { id: t.customerId ?? '' } })}
                          >
                            {getCustomerName(t.customerId)}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Usul">{METHOD_LABELS[t.method]}</td>
                      <td data-label="Summa" className={`align-right nowrap strong ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                        {t.type === 'income' ? '+' : '−'}
                        {money(t.amount)}
                      </td>
                      <td className="cell-actions">
                        <div className="row-actions">
                          <IconButton
                            icon="edit"
                            label="Tranzaksiyani tahrirlash"
                            onClick={() => openModal({ type: 'transaction', payload: { id: t.id } })}
                          />
                          <IconButton icon="trash" tone="danger" label="Tranzaksiyani o'chirish" onClick={() => handleDelete(t)} />
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
    </>
  )
}
