import { useState } from 'react'
import { FUNNEL_STAGES, Icon, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useConfirm } from '../../hooks/useConfirm'
import { usePersistentState } from '../../hooks/usePersistentState'
import type { Customer, CustomerFilters, CustomerSortKey, CustomerStatus, CustomerView } from '../../types/customer.types'
import type { SortDirection } from '../../types/dashboard.types'
import { cx, toOptions } from '../../utils/cx'
import { deleteCustomerMessage, EMPTY_CUSTOMER_FILTERS, filterCustomers, hasActiveFilters, sortCustomers } from '../../utils/customers'
import { paginate } from '../../utils/list'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Pagination } from '../ui/Pagination'
import { Select } from '../ui/Select'
import { SortHeader } from '../ui/SortHeader'
import { CustomerKanban } from './CustomerKanban'

const STATUS_OPTIONS = FUNNEL_STAGES.map((stage) => ({ value: stage, label: STATUS_LABELS[stage] }))

export const CUSTOMER_VIEW_KEY = 'apex:customers-view'
const isView = (value: unknown): value is CustomerView => value === 'table' || value === 'kanban'
const VIEWS: Array<{ id: CustomerView; label: string; icon: 'list' | 'kanban' }> = [
  { id: 'table', label: 'Jadval', icon: 'list' },
  { id: 'kanban', label: 'Kanban', icon: 'kanban' },
]

// Mobilda jadval sarlavhasi yashiriladi, saralash shu ro'yxat orqali
const MOBILE_SORTS = [
  { value: 'createdAt:desc', label: 'Eng yangi' },
  { value: 'createdAt:asc', label: 'Eng eski' },
  { value: 'name:asc', label: 'Ism (A–Z)' },
  { value: 'name:desc', label: 'Ism (Z–A)' },
  { value: 'course:asc', label: 'Kurs bo\'yicha' },
  { value: 'status:asc', label: 'Holat bo\'yicha' },
]

export function CustomerTable() {
  const {
    customers,
    courses,
    search,
    setSearch,
    customerFilters: filters,
    setCustomerFilters,
    customerSort: sort,
    setCustomerSort,
    updateCustomer,
    deleteCustomer,
    openModal,
    formatDate,
    transactions,
    money,
  } = useDashboard()
  const confirm = useConfirm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [view, setView] = usePersistentState<CustomerView>(CUSTOMER_VIEW_KEY, 'table', isView)

  // Qidiruv, filtr yoki saralash o'zgarsa birinchi sahifaga qaytiladi
  const viewKey = JSON.stringify([search, filters, sort])
  const [prevViewKey, setPrevViewKey] = useState(viewKey)
  if (viewKey !== prevViewKey) {
    setPrevViewKey(viewKey)
    setPage(1)
  }

  // Filtrda barcha kurslar (arxivdagilar ham) va mijozlarda uchraydigan boshqa nomlar
  const courseOptions = Array.from(new Set([...courses.map((c) => c.name), ...customers.map((c) => c.course)])).filter(Boolean)
  const filtered = sortCustomers(filterCustomers(customers, search, filters), sort)
  const current = paginate(filtered, page, pageSize)
  const filtersActive = hasActiveFilters(filters) || search.trim() !== ''

  const setFilter = <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => {
    setCustomerFilters({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
    setSearch('')
  }

  const handleDelete = async (customer: Customer) => {
    const ok = await confirm({
      title: 'Mijozni o\'chirish',
      message: deleteCustomerMessage(customer, transactions, money),
      confirmLabel: 'O\'chirish',
    })
    if (ok) deleteCustomer(customer.id)
  }

  return (
    <section className="card" aria-labelledby="customers-title">
      <div className="card-head">
        <div>
          <h2 id="customers-title">Mijozlar va lidlar</h2>
          <span className="muted">
            {filtered.length} ta natija (jami {customers.length})
          </span>
        </div>
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Ko'rinish">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} className={cx(view === v.id && 'is-active')} onClick={() => setView(v.id)}>
                <Icon name={v.icon} size={15} />
                {v.label}
              </button>
            ))}
          </div>
          <Button icon="plus" onClick={() => openModal({ type: 'customer' })}>
            Yangi mijoz
          </Button>
        </div>
      </div>

      <div className="filters">
        <Select
          label="Holat"
          hideLabel
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value as CustomerFilters['status'])}
          options={[{ value: 'all', label: 'Barcha bosqichlar' }, ...STATUS_OPTIONS]}
        />
        <Select
          label="Kurs"
          hideLabel
          value={filters.course}
          onChange={(e) => setFilter('course', e.target.value)}
          options={[{ value: 'all', label: 'Barcha kurslar' }, ...courseOptions.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          label="Manba"
          hideLabel
          value={filters.source}
          onChange={(e) => setFilter('source', e.target.value as CustomerFilters['source'])}
          options={[{ value: 'all', label: 'Barcha manbalar' }, ...toOptions(SOURCE_LABELS)]}
        />
        <div className="date-range" role="group" aria-label="Qo'shilgan sana">
          <Input label="Dan" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
          <Input label="Gacha" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
        </div>
        {view === 'table' && (
          <Select
            label="Saralash"
            hideLabel
            className="mobile-only"
            value={`${sort.key}:${sort.direction}`}
            onChange={(e) => {
              const [key, direction] = e.target.value.split(':') as [CustomerSortKey, SortDirection]
              setCustomerSort({ key, direction })
            }}
            options={MOBILE_SORTS}
          />
        )}
        {filtersActive && (
          <Button variant="subtle" icon="close" onClick={clearFilters}>
            Filtrlarni tozalash
          </Button>
        )}
      </div>

      {view === 'kanban' && filtered.length > 0 ? (
        <CustomerKanban customers={filtered} />
      ) : current.total === 0 ? (
        customers.length === 0 ? (
          <EmptyState
            title="Hali mijoz yo'q"
            description="Birinchi mijozingizni qo'shing — u shu yerda paydo bo'ladi."
            action={
              <Button icon="plus" onClick={() => openModal({ type: 'customer' })}>
                Mijoz qo'shish
              </Button>
            }
          />
        ) : (
          <EmptyState
            variant="search"
            title="Hech narsa topilmadi"
            description="Qidiruv so'zini yoki filtrlarni o'zgartirib ko'ring."
            action={
              <Button variant="ghost" icon="close" onClick={clearFilters}>
                Filtrlarni tozalash
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <SortHeader label="Ism" sortKey="name" sort={sort} onSort={setCustomerSort} />
                  <th scope="col">Telefon</th>
                  <SortHeader label="Kurs" sortKey="course" sort={sort} onSort={setCustomerSort} />
                  <SortHeader label="Holat" sortKey="status" sort={sort} onSort={setCustomerSort} />
                  <th scope="col">Manba</th>
                  <SortHeader label="Qo'shilgan" sortKey="createdAt" sort={sort} onSort={setCustomerSort} />
                  <th scope="col">
                    <span className="sr-only">Amallar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {current.items.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Ism">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => openModal({ type: 'customerDetail', payload: { id: c.id } })}
                      >
                        {c.name}
                      </button>
                      {c.email && <small className="cell-sub">{c.email}</small>}
                    </td>
                    <td data-label="Telefon" className="nowrap">
                      {c.phone}
                    </td>
                    <td data-label="Kurs">{c.course}</td>
                    <td data-label="Holat">
                      <select
                        className={`status-select badge-${c.status}`}
                        value={c.status}
                        aria-label={`${c.name} holati`}
                        onChange={(e) => updateCustomer(c.id, { status: e.target.value as CustomerStatus })}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Manba">{SOURCE_LABELS[c.source]}</td>
                    <td data-label="Qo'shilgan" className="nowrap">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <IconButton
                          icon="eye"
                          label={`${c.name} kartasi`}
                          onClick={() => openModal({ type: 'customerDetail', payload: { id: c.id } })}
                        />
                        <IconButton
                          icon="edit"
                          label={`${c.name}ni tahrirlash`}
                          onClick={() => openModal({ type: 'customer', payload: { id: c.id } })}
                        />
                        <IconButton icon="trash" tone="danger" label={`${c.name}ni o'chirish`} onClick={() => handleDelete(c)} />
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
  )
}
