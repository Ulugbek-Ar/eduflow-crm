import { DATE_RANGE_LABELS, Icon, NAV_ITEMS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useConfirm } from '../../hooks/useConfirm'
import { createBackup } from '../../services/storage.service'
import { dateStamp, downloadJson, exportRows } from '../../services/export.service'
import type { ExportFormat } from '../../services/export.service'
import type { DateRange } from '../../types/dashboard.types'
import { filterCustomers, sortCustomers } from '../../utils/customers'
import { customerColumns, transactionColumns } from '../../utils/reports'
import { filterTransactions, sortTransactions, transactionPeriod } from '../../utils/transactions'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { Dropdown } from '../ui/Dropdown'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { BACKUP_FILE_PREFIX } from '../../constants/app'

const RANGES = Object.keys(DATE_RANGE_LABELS) as DateRange[]

export function Header() {
  const {
    activeSection,
    search,
    setSearch,
    dateRange,
    setDateRange,
    customers,
    transactions,
    settings,
    customerFilters,
    customerSort,
    transactionFilters,
    transactionSort,
    getCustomerName,
    toggleSidebar,
    formatDate,
    isDemo,
    clearDemoData,
  } = useDashboard()
  const confirm = useConfirm()

  const title = NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? ''
  const options = { delimiter: settings.csvDelimiter }

  // Eksport joriy filtr, qidiruv va saralash bo'yicha ko'rinib turgan ro'yxatdan olinadi
  const exportCustomers = (format: ExportFormat) => {
    const rows = sortCustomers(filterCustomers(customers, search, customerFilters), customerSort)
    exportRows('mijozlar', rows, customerColumns(formatDate), format, { ...options, sheetName: 'Mijozlar' })
  }

  const exportTransactions = (format: ExportFormat) => {
    const { period } = transactionPeriod(transactionFilters, dateRange)
    const rows = sortTransactions(filterTransactions(transactions, transactionFilters, period, search, getCustomerName), transactionSort)
    exportRows('tranzaksiyalar', rows, transactionColumns(formatDate, getCustomerName), format, { ...options, sheetName: 'Tranzaksiyalar' })
  }

  const exportBackup = () => {
    downloadJson(`${BACKUP_FILE_PREFIX}-${dateStamp()}.json`, createBackup({ customers, transactions, settings }))
  }

  const handleClearDemo = async () => {
    const ok = await confirm({
      title: 'Demo ma\'lumotni tozalash',
      message: `Barcha mijozlar (${customers.length}) va tranzaksiyalar (${transactions.length}) o'chiriladi, jumladan demo rejimda o'zingiz qo'shganlari ham. Sozlamalar va kurslar saqlanib qoladi. Davom etasizmi?`,
      confirmLabel: 'Tozalash',
    })
    if (ok) clearDemoData()
  }

  return (
    <header className="header">
      <div className="header-title">
        <IconButton icon="menu" label="Menyuni ochish" className="menu-btn" onClick={toggleSidebar} />
        <h1>{title}</h1>
        {isDemo && (
          <span className="demo-banner">
            <Badge tone="primary">Demo ma'lumot</Badge>
            <Button variant="ghost" size="sm" icon="trash" onClick={handleClearDemo}>
              <span className="hide-mobile">Demo ma'lumotni tozalash</span>
              <span className="show-mobile">Tozalash</span>
            </Button>
          </span>
        )}
      </div>

      <div className="header-actions">
        <div className="search" role="search">
          <Icon name="search" size={16} />
          <label htmlFor="global-search" className="sr-only">
            Qidiruv
          </label>
          <input
            id="global-search"
            type="search"
            placeholder="Qidiruv..."
            aria-keyshortcuts="Control+K Meta+K"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd className="search-kbd" aria-hidden="true">
            Ctrl K
          </kbd>
        </div>

        <div className="segmented" role="group" aria-label="Davr">
          {RANGES.map((range) => (
            <button key={range} type="button" aria-pressed={dateRange === range} className={dateRange === range ? 'is-active' : undefined} onClick={() => setDateRange(range)}>
              {DATE_RANGE_LABELS[range]}
            </button>
          ))}
        </div>

        <div className="header-icons">
          <ThemeToggle />
          <NotificationBell />
        </div>

        <Dropdown
          label="Hisobot yuklash"
          trigger={(props) => (
            <Button icon="download" {...props}>
              <span className="hide-mobile">Hisobot yuklash</span>
              <span className="show-mobile">Hisobot</span>
              <Icon name="chevronDown" size={14} />
            </Button>
          )}
          sections={[
            {
              label: 'Mijozlar',
              items: [
                { id: 'customers-csv', label: 'Mijozlar — CSV', icon: 'fileText', onSelect: () => exportCustomers('csv') },
                { id: 'customers-xls', label: 'Mijozlar — Excel', icon: 'sheet', onSelect: () => exportCustomers('xls') },
              ],
            },
            {
              label: 'Tranzaksiyalar',
              items: [
                { id: 'tx-csv', label: 'Tranzaksiyalar — CSV', icon: 'fileText', onSelect: () => exportTransactions('csv') },
                { id: 'tx-xls', label: 'Tranzaksiyalar — Excel', icon: 'sheet', onSelect: () => exportTransactions('xls') },
              ],
            },
            {
              label: 'Zaxira',
              items: [
                {
                  id: 'backup',
                  label: 'To\'liq zaxira — JSON',
                  description: 'Barcha ma\'lumot va sozlamalar',
                  icon: 'database',
                  onSelect: exportBackup,
                },
              ],
            },
          ]}
        />
      </div>
    </header>
  )
}
