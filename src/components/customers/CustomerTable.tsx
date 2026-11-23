import { tr } from '../../i18n'
import { useState } from 'react'
import { FUNNEL_STAGES, Icon, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { usePersistentState } from '../../hooks/usePersistentState'
import type { Customer, CustomerFilters, CustomerSortKey, CustomerStatus, CustomerView } from '../../types/customer.types'
import type { SortDirection } from '../../types/dashboard.types'
import { cx, toOptions } from '../../utils/cx'
import { deleteCustomerMessage, EMPTY_CUSTOMER_FILTERS, filterCustomers, hasActiveFilters, sortCustomers } from '../../utils/customers'
import { countActive, paginate } from '../../utils/list'
import { Badge } from '../ui/Badge'
import { FilterPanel } from '../ui/FilterPanel'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { DateInput } from '../ui/DateInput'
import { Pagination } from '../ui/Pagination'
import { Select } from '../ui/Select'
import { SortHeader } from '../ui/SortHeader'
import { CustomerKanban } from './CustomerKanban'

const STATUS_OPTIONS = FUNNEL_STAGES.map((stage) => ({ value: stage, label: STATUS_LABELS[stage] }))

export const CUSTOMER_VIEW_KEY = 'apex:customers-view'
const isView = (value: unknown): value is CustomerView => value === 'table' || value === 'kanban'
const VIEWS: Array<{ id: CustomerView; label: string; icon: 'list' | 'kanban' }> = [
  { id: 'table', label: tr('Jadval'), icon: 'list' },
  { id: 'kanban', label: tr('Kanban'), icon: 'kanban' },
]

// Mobilda jadval sarlavhasi yashiriladi, saralash shu ro'yxat orqali
const MOBILE_SORTS = [
  { value: 'createdAt:desc', label: tr('Eng yangi') },
  { value: 'createdAt:asc', label: tr('Eng eski') },
  { value: 'name:asc', label: tr('Ism (A–Z)') },
  { value: 'name:desc', label: tr('Ism (Z–A)') },
  { value: 'course:asc', label: tr('Kurs bo\'yicha') },
  { value: 'status:asc', label: tr('Holat bo\'yicha') },
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
    settings,
  } = useDashboard()
  const confirm = useConfirm()
  const can = useCan()
  const canEdit = can('customers.edit')
  const canDelete = can('customers.delete')
  const [page, setPage] = useState(1)
  const [dateResetKey, setDateResetKey] = useState(0)
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
    // Chala yozilgan sana matni ham tozalansin — sana maydonlari qayta yaratiladi
    setDateResetKey((k) => k + 1)
    setCustomerFilters(EMPTY_CUSTOMER_FILTERS)
    setSearch('')
  }

  const handleDelete = async (customer: Customer) => {
    const ok = await confirm({
      title: tr('Mijozni o\'chirish'),
      message: deleteCustomerMessage(customer, transactions, money),
      confirmLabel: tr('O\'chirish'),
    })
    if (ok) deleteCustomer(customer.id)
  }

  return (
    <section className="card" aria-labelledby="customers-title">
      <div className="card-head">
        <div>
          <h2 id="customers-title">{tr('Mijozlar va lidlar')}</h2>
          <span className="muted">
            {filtered.length} {tr('ta natija (jami')} {customers.length})
          </span>
        </div>
        <div className="toolbar">
          <div className="segmented" role="group" aria-label={tr('Ko\'rinish')}>
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} className={cx(view === v.id && 'is-active')} onClick={() => setView(v.id)}>
                <Icon name={v.icon} size={15} />
                {v.label}
              </button>
            ))}
          </div>
          {canEdit && (
            <Button variant="ghost" icon="upload" onClick={() => openModal({ type: 'import' })}>
              {tr('Import')}
            </Button>
          )}
          {canEdit && (
            <Button icon="plus" onClick={() => openModal({ type: 'customer' })}>
              {tr('Yangi mijoz')}
            </Button>
          )}
        </div>
      </div>

      <FilterPanel activeCount={countActive(filters, EMPTY_CUSTOMER_FILTERS)}>
        <Select
          label={tr('Holat')}
          hideLabel
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value as CustomerFilters['status'])}
          options={[{ value: 'all', label: tr('Barcha bosqichlar') }, ...STATUS_OPTIONS]}
        />
        <Select
          label={tr('Kurs')}
          hideLabel
          value={filters.course}
          onChange={(e) => setFilter('course', e.target.value)}
          options={[{ value: 'all', label: tr('Barcha kurslar') }, ...courseOptions.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          label={tr('Manba')}
          hideLabel
          value={filters.source}
          onChange={(e) => setFilter('source', e.target.value as CustomerFilters['source'])}
          options={[{ value: 'all', label: tr('Barcha manbalar') }, ...toOptions(SOURCE_LABELS)]}
        />
        <div className="date-range" role="group" aria-label={tr('Qo\'shilgan sana')}>
          <DateInput key={`from-${dateResetKey}`} label={tr('Dan')} format={settings.dateFormat} value={filters.from} max={filters.to || undefined} onChange={(value) => setFilter('from', value)} />
          <DateInput key={`to-${dateResetKey}`} label={tr('Gacha')} format={settings.dateFormat} value={filters.to} min={filters.from || undefined} onChange={(value) => setFilter('to', value)} />
        </div>
        {view === 'table' && (
          <Select
            label={tr('Saralash')}
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
            {tr('Filtrlarni tozalash')}
          </Button>
        )}
      </FilterPanel>

      {view === 'kanban' && filtered.length > 0 ? (
        <CustomerKanban customers={filtered} />
      ) : current.total === 0 ? (
        customers.length === 0 ? (
          <EmptyState
            title={tr('Hali mijoz yo\'q')}
            description={tr('Birinchi mijozingizni qo\'shing yoki ro\'yxatni Excel/CSV fayldan import qiling.')}
            action={
              canEdit && (
                <div className="toolbar">
                  <Button icon="plus" onClick={() => openModal({ type: 'customer' })}>
                    {tr('Mijoz qo\'shish')}
                  </Button>
                  <Button variant="ghost" icon="upload" onClick={() => openModal({ type: 'import' })}>
                    {tr('Excel/CSV\'dan import')}
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <EmptyState
            variant="search"
            title={tr('Hech narsa topilmadi')}
            description={tr('Qidiruv so\'zini yoki filtrlarni o\'zgartirib ko\'ring.')}
            action={
              <Button variant="ghost" icon="close" onClick={clearFilters}>
                {tr('Filtrlarni tozalash')}
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
                  <SortHeader label={tr('Ism')} sortKey="name" sort={sort} onSort={setCustomerSort} />
                  <th scope="col">{tr('Telefon')}</th>
                  <SortHeader label={tr('Kurs')} sortKey="course" sort={sort} onSort={setCustomerSort} />
                  <SortHeader label={tr('Holat')} sortKey="status" sort={sort} onSort={setCustomerSort} />
                  <th scope="col" className="col-optional">
                    {tr('Manba')}
                  </th>
                  <SortHeader label={tr('Qo\'shilgan')} sortKey="createdAt" sort={sort} onSort={setCustomerSort} />
                  <th scope="col">
                    <span className="sr-only">{tr('Amallar')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {current.items.map((c) => (
                  <tr key={c.id}>
                    <td data-label={tr('Ism')}>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => openModal({ type: 'customerDetail', payload: { id: c.id } })}
                      >
                        {c.name}
                      </button>
                      <small className="cell-sub show-compact">{SOURCE_LABELS[c.source]}</small>
                      {c.email && <small className="cell-sub">{c.email}</small>}
                    </td>
                    <td data-label={tr('Telefon')} className="nowrap">
                      {c.phone}
                    </td>
                    <td data-label={tr('Kurs')}>{c.course}</td>
                    <td data-label={tr('Holat')}>
                      {canEdit ? (
                        <select
                          className={`status-select badge-${c.status}`}
                          value={c.status}
                          aria-label={tr('{0} holati', { 0: c.name })}
                          onChange={(e) => updateCustomer(c.id, { status: e.target.value as CustomerStatus })}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone={c.status}>{STATUS_LABELS[c.status]}</Badge>
                      )}
                    </td>
                    <td data-label={tr('Manba')} className="col-optional">
                      {SOURCE_LABELS[c.source]}
                    </td>
                    <td data-label={tr('Qo\'shilgan')} className="nowrap">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <IconButton
                          icon="eye"
                          label={tr('{0} kartasi', { 0: c.name })}
                          onClick={() => openModal({ type: 'customerDetail', payload: { id: c.id } })}
                        />
                        {canEdit && (
                          <IconButton
                            icon="edit"
                            label={tr('{0}ni tahrirlash', { 0: c.name })}
                            onClick={() => openModal({ type: 'customer', payload: { id: c.id } })}
                          />
                        )}
                        {canDelete && <IconButton icon="trash" tone="danger" label={tr('{0}ni o\'chirish', { 0: c.name })} onClick={() => handleDelete(c)} />}
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
