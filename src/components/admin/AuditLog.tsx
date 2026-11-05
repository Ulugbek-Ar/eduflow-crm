import { useState, useSyncExternalStore } from 'react'
import { ROLE_LABELS } from '../../auth/permissions'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import {
  actionCategory,
  AUDIT_ACTION_LABELS,
  AUDIT_CATEGORY_LABELS,
  EMPTY_AUDIT_FILTERS,
  filterAudit,
  getAuditSnapshot,
  subscribeAudit,
} from '../../services/audit.service'
import type { AuditCategory, AuditFilters } from '../../services/audit.service'
import { exportRows } from '../../services/export.service'
import type { ExportFormat } from '../../services/export.service'
import { toOptions } from '../../utils/cx'
import { formatDateTimeWith } from '../../utils/format'
import { paginate } from '../../utils/list'
import { auditColumns } from '../../utils/reports'
import { Badge } from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'
import { Button } from '../ui/Button'
import { DateInput } from '../ui/DateInput'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Pagination } from '../ui/Pagination'
import { Select } from '../ui/Select'

const CATEGORY_TONE: Record<AuditCategory, BadgeTone> = {
  customers: 'primary',
  payments: 'paid',
  courses: 'contacted',
  staff: 'warning',
  auth: 'neutral',
  data: 'thinking',
}

export function AuditLog() {
  const { settings, logExport } = useDashboard()
  const { users } = useAuth()
  const entries = useSyncExternalStore(subscribeAudit, getAuditSnapshot)
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [resetKey, setResetKey] = useState(0)

  const rows = filterAudit(entries, filters)
  const current = paginate(rows, page, pageSize)
  const active = JSON.stringify(filters) !== JSON.stringify(EMPTY_AUDIT_FILTERS)
  const formatDateTime = (iso: string) => formatDateTimeWith(iso, settings.dateFormat)

  // Jurnalda o'chirilgan xodimlar ham ismi bilan qoladi — filtr ro'yxati yozuvlardan ham olinadi
  const people = new Map<string, string>()
  for (const u of users) people.set(u.id, u.fullName || u.login)
  for (const e of entries) if (e.userId && !people.has(e.userId)) people.set(e.userId, e.userName)

  const setFilter = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const download = (format: ExportFormat) => {
    exportRows('amallar-jurnali', rows, auditColumns(formatDateTime), format, { delimiter: settings.csvDelimiter, sheetName: 'Amallar jurnali' })
    logExport(`Amallar jurnali — ${format === 'csv' ? 'CSV' : 'Excel'} (${rows.length} ta)`)
  }

  return (
    <section className="card" aria-label="Amallar jurnali">
      <div className="card-head">
        <div>
          <h2>Amallar jurnali</h2>
          <span className="muted">Kim, qachon va nima qilgani · {rows.length} ta yozuv · oxirgi 1 yil</span>
        </div>
        <div className="toolbar">
          <Button variant="ghost" size="sm" icon="fileText" disabled={rows.length === 0} onClick={() => download('csv')}>
            CSV
          </Button>
          <Button variant="ghost" size="sm" icon="sheet" disabled={rows.length === 0} onClick={() => download('xls')}>
            Excel
          </Button>
        </div>
      </div>

      <div className="filters">
        <Input
          label="Jurnaldan qidirish"
          type="search"
          value={filters.query}
          placeholder="Ism, mijoz yoki summa"
          onChange={(e) => setFilter('query', e.target.value)}
        />
        <Select
          label="Xodim"
          value={filters.userId}
          onChange={(e) => setFilter('userId', e.target.value)}
          options={[{ value: 'all', label: 'Barcha xodimlar' }, ...Array.from(people, ([value, label]) => ({ value, label }))]}
        />
        <Select
          label="Bo'lim"
          value={filters.category}
          onChange={(e) => setFilter('category', e.target.value as AuditFilters['category'])}
          options={[{ value: 'all', label: 'Barcha bo\'limlar' }, ...toOptions(AUDIT_CATEGORY_LABELS)]}
        />
        <div className="date-range">
          <DateInput key={`from-${resetKey}`} label="Dan" format={settings.dateFormat} value={filters.from} max={filters.to || undefined} onChange={(v) => setFilter('from', v)} />
          <DateInput key={`to-${resetKey}`} label="Gacha" format={settings.dateFormat} value={filters.to} min={filters.from || undefined} onChange={(v) => setFilter('to', v)} />
        </div>
        {active && (
          <Button
            variant="subtle"
            icon="close"
            onClick={() => {
              setFilters(EMPTY_AUDIT_FILTERS)
              setResetKey((k) => k + 1)
              setPage(1)
            }}
          >
            Filtrlarni tozalash
          </Button>
        )}
      </div>

      {current.total === 0 ? (
        <EmptyState
          variant={entries.length === 0 ? 'empty' : 'search'}
          title={entries.length === 0 ? 'Jurnal hali bo\'sh' : 'Hech narsa topilmadi'}
          description={entries.length === 0 ? 'Xodimlar mijoz qo\'shsa, to\'lov yozsa yoki tizimga kirsa — shu yerda ko\'rinadi.' : 'Filtrlarni o\'zgartirib ko\'ring.'}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Vaqt</th>
                  <th scope="col">Xodim</th>
                  <th scope="col">Amal</th>
                  <th scope="col">Tafsilot</th>
                </tr>
              </thead>
              <tbody>
                {current.items.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Vaqt" className="nowrap">
                      {formatDateTime(e.at)}
                    </td>
                    <td data-label="Xodim">
                      {e.userName}
                      {e.role && <small className="cell-sub">{ROLE_LABELS[e.role]}</small>}
                    </td>
                    <td data-label="Amal">
                      <Badge tone={e.action === 'auth.failed' ? 'cancelled' : CATEGORY_TONE[actionCategory(e.action)]}>{AUDIT_ACTION_LABELS[e.action]}</Badge>
                    </td>
                    <td data-label="Tafsilot" className="cell-wide">
                      {e.summary || '—'}
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
