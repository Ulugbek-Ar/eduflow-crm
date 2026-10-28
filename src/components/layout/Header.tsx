import { DATE_RANGE_LABELS, Icon, METHOD_LABELS, NAV_ITEMS, SOURCE_LABELS, STATUS_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { dateStamp, exportToCsv } from '../../services/export.service'
import type { DateRange } from '../../types/dashboard.types'
import { formatDate, isInRange } from '../../utils/format'

const RANGES = Object.keys(DATE_RANGE_LABELS) as DateRange[]

export function Header() {
  const { activeSection, search, setSearch, dateRange, setDateRange, customers, transactions, getCustomerName, toggleSidebar } =
    useDashboard()

  const title = NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? ''

  const handleExport = () => {
    if (activeSection === 'customers') {
      exportToCsv(`mijozlar-${dateStamp()}.csv`, customers, [
        { header: 'Ism', value: (c) => c.name },
        { header: 'Telefon', value: (c) => c.phone },
        { header: 'Kurs', value: (c) => c.course },
        { header: 'Holat', value: (c) => STATUS_LABELS[c.status] },
        { header: 'Manba', value: (c) => SOURCE_LABELS[c.source] },
        { header: 'Qo\'shilgan sana', value: (c) => formatDate(c.createdAt) },
      ])
      return
    }
    const rows = transactions.filter((t) => isInRange(t.date, dateRange))
    exportToCsv(`hisobot-${dateRange}-${dateStamp()}.csv`, rows, [
      { header: 'Sana', value: (t) => formatDate(t.date) },
      { header: 'Turi', value: (t) => TYPE_LABELS[t.type] },
      { header: 'Summa', value: (t) => (t.type === 'income' ? t.amount : -t.amount) },
      { header: 'To\'lov usuli', value: (t) => METHOD_LABELS[t.method] },
      { header: 'Mijoz', value: (t) => getCustomerName(t.customerId) },
      { header: 'Izoh', value: (t) => t.note },
    ])
  }

  return (
    <header className="header">
      <div className="header-title">
        <button type="button" className="icon-btn menu-btn" aria-label="Menyu" onClick={toggleSidebar}>
          <Icon name="menu" />
        </button>
        <h1>{title}</h1>
      </div>

      <div className="header-actions">
        <label className="search">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Ism, telefon yoki izoh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="segmented" role="group" aria-label="Davr">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              className={dateRange === range ? 'is-active' : undefined}
              onClick={() => setDateRange(range)}
            >
              {DATE_RANGE_LABELS[range]}
            </button>
          ))}
        </div>

        <button type="button" className="btn btn-primary" onClick={handleExport}>
          <Icon name="download" size={16} />
          <span>Hisobot yuklash</span>
        </button>
      </div>
    </header>
  )
}
