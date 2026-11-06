import { tr } from '../../i18n'
import { useState } from 'react'
import { Icon, NAV_ITEMS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useAuth, useCan } from '../../hooks/useAuth'
import { useQuickAdd } from '../../hooks/useQuickAdd'
import { useConfirm } from '../../hooks/useConfirm'
import { createBackup } from '../../services/storage.service'
import { dateStamp, downloadJson, exportRows } from '../../services/export.service'
import type { ExportFormat } from '../../services/export.service'
import type { Section } from '../../types/dashboard.types'
import { filterCustomers, sortCustomers } from '../../utils/customers'
import { customerColumns, transactionColumns } from '../../utils/reports'
import { globalSearch } from '../../utils/search'
import { filterTransactions, sortTransactions, transactionPeriod } from '../../utils/transactions'
import { cx } from '../../utils/cx'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { Dropdown } from '../ui/Dropdown'
import { NotificationBell } from './NotificationBell'
import { ProfileMenu } from './ProfileMenu'
import { SearchResults } from './SearchResults'
import { ThemeToggle } from './ThemeToggle'
import { BACKUP_FILE_PREFIX } from '../../constants/app'

const LIST_SECTIONS: readonly Section[] = ['customers', 'finance', 'courses']

export function Header() {
  const {
    activeSection,
    search,
    setSearch,
    dateRange,
    customers,
    transactions,
    settings,
    courses,
    customerFilters,
    customerSort,
    transactionFilters,
    transactionSort,
    getCustomerName,
    logExport,
    formatDate,
    isDemo,
    clearDemoData,
  } = useDashboard()
  const confirm = useConfirm()
  const can = useCan()
  // Alohida demo markazda yuqoridagi demo tasmasi bor — bu belgi faqat haqiqiy bazadagi namunaviy ma'lumot uchun
  const { mode } = useAuth()
  const quickAdd = useQuickAdd()
  const [resultsOpen, setResultsOpen] = useState(false)
  // Telefonda qidiruv tugma orqali ochiladi (header bitta qatorda qoladi)
  const [searchOpen, setSearchOpen] = useState(false)
  const searching = searchOpen || search !== ''
  // Bu bo'limlar ro'yxatni o'zi filtrlaydi; qolganlarida natijalar oynasi chiqadi
  const showResults = resultsOpen && !LIST_SECTIONS.includes(activeSection) && search.trim().length >= 2

  const title = NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? ''
  const options = { delimiter: settings.csvDelimiter }

  // Eksport joriy filtr, qidiruv va saralash bo'yicha ko'rinib turgan ro'yxatdan olinadi
  const exportCustomers = (format: ExportFormat) => {
    const rows = sortCustomers(filterCustomers(customers, search, customerFilters), customerSort)
    exportRows('mijozlar', rows, customerColumns(formatDate), format, { ...options, sheetName: 'Mijozlar' })
    logExport(`Mijozlar — ${format === 'csv' ? 'CSV' : 'Excel'} (${rows.length} ta)`)
  }

  const exportTransactions = (format: ExportFormat) => {
    const { period } = transactionPeriod(transactionFilters, dateRange)
    const rows = sortTransactions(filterTransactions(transactions, transactionFilters, period, search, getCustomerName), transactionSort)
    exportRows('tranzaksiyalar', rows, transactionColumns(formatDate, getCustomerName), format, { ...options, sheetName: 'Tranzaksiyalar' })
    logExport(`Tranzaksiyalar — ${format === 'csv' ? 'CSV' : 'Excel'} (${rows.length} ta)`)
  }

  const exportBackup = () => {
    downloadJson(`${BACKUP_FILE_PREFIX}-${dateStamp()}.json`, createBackup({ customers, transactions, courses, settings }))
    logExport('To\'liq zaxira (JSON)', 'backup')
  }

  // Faqat ruxsat berilgan hisobotlar: kuzatuvchi va menejer hisobot yuklamaydi, zaxira — faqat administrator
  const exportSections = [
    {
      label: tr('Mijozlar'),
      show: can('reports.export') && can('customers.view'),
      items: [
        { id: 'customers-csv', label: tr('Mijozlar — CSV'), icon: 'fileText' as const, onSelect: () => exportCustomers('csv') },
        { id: 'customers-xls', label: tr('Mijozlar — Excel'), icon: 'sheet' as const, onSelect: () => exportCustomers('xls') },
      ],
    },
    {
      label: tr('Tranzaksiyalar'),
      show: can('reports.export') && can('payments.view'),
      items: [
        { id: 'tx-csv', label: tr('Tranzaksiyalar — CSV'), icon: 'fileText' as const, onSelect: () => exportTransactions('csv') },
        { id: 'tx-xls', label: tr('Tranzaksiyalar — Excel'), icon: 'sheet' as const, onSelect: () => exportTransactions('xls') },
      ],
    },
    {
      label: tr('Zaxira'),
      show: can('data.manage'),
      items: [
        {
          id: 'backup',
          label: tr('To\'liq zaxira — JSON'),
          description: tr('Barcha ma\'lumot va sozlamalar'),
          icon: 'database' as const,
          onSelect: exportBackup,
        },
      ],
    },
  ]
    .filter((section) => section.show)
    .map(({ label, items }) => ({ label, items }))

  const handleClearDemo = async () => {
    const ok = await confirm({
      title: tr('Demo ma\'lumotni tozalash'),
      message: tr('Barcha mijozlar ({0}) va tranzaksiyalar ({1}) o\'chiriladi, jumladan demo rejimda o\'zingiz qo\'shganlari ham. Sozlamalar va kurslar saqlanib qoladi. Davom etasizmi?', { 0: customers.length, 1: transactions.length }),
      confirmLabel: tr('Tozalash'),
    })
    if (ok) clearDemoData()
  }

  return (
    <header className={cx('header', searching && 'is-searching')}>
      <div className="header-title">
        <h1>{title}</h1>
        {isDemo && mode === 'main' && can('data.manage') && (
          <span className="demo-banner">
            <Badge tone="primary">{tr('Demo ma\'lumot')}</Badge>
            <Button variant="ghost" size="sm" icon="trash" onClick={handleClearDemo}>
              <span className="hide-mobile">{tr('Demo ma\'lumotni tozalash')}</span>
              <span className="show-mobile">{tr('Tozalash')}</span>
            </Button>
          </span>
        )}
      </div>

      <div className="header-actions">
        <div
          className="search"
          role="search"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setResultsOpen(false)
          }}
        >
          <Icon name="search" size={16} />
          <label htmlFor="global-search" className="sr-only">
            {tr('Qidiruv')}
          </label>
          <input
            id="global-search"
            type="search"
            placeholder={tr('Qidiruv...')}
            aria-keyshortcuts="Control+K Meta+K"
            aria-controls={showResults ? 'search-results' : undefined}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setResultsOpen(true)
            }}
            onFocus={() => setResultsOpen(true)}
            onBlur={(e) => {
              if (!e.target.value) setSearchOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && showResults) {
                e.preventDefault()
                document.querySelector<HTMLElement>('#search-results .search-result')?.focus()
              } else if (e.key === 'Escape' && showResults) {
                setResultsOpen(false)
              }
            }}
          />
          {showResults && (
            <SearchResults
              id="search-results"
              results={globalSearch(search, customers, courses, transactions, getCustomerName)}
              onClose={(focusInput) => {
                setResultsOpen(false)
                if (focusInput) document.getElementById('global-search')?.focus()
              }}
            />
          )}
          <kbd className="search-kbd" aria-hidden="true">
            {tr('Ctrl K')}
          </kbd>
        </div>

        <IconButton
          icon="search"
          label={tr('Qidirish')}
          className="header-icon-btn search-toggle"
          aria-expanded={searching}
          onClick={() => {
            setSearchOpen(true)
            // Maydon ko'rinishi bilan fokus unga o'tadi
            window.requestAnimationFrame(() => document.getElementById('global-search')?.focus())
          }}
        />


        {quickAdd.length > 0 && (
          <Dropdown
            label={tr('Qo\'shish')}
            className="header-add"
            trigger={(props) => (
              <Button icon="plus" {...props}>
                {tr('Qo\'shish')}
                <Icon name="chevronDown" size={14} />
              </Button>
            )}
            sections={[{ label: tr('Yangi yozuv'), items: quickAdd.map((a) => ({ id: a.id, label: a.label, description: a.description, icon: a.icon, onSelect: a.run })) }]}
          />
        )}

        <div className="header-icons">
          <ThemeToggle />
          <NotificationBell />
        </div>

        {exportSections.length > 0 && (
        <Dropdown
          label={tr('Hisobot yuklash')}
          className="header-export-menu"
          trigger={(props) => (
            <Button variant="ghost" icon="download" className="header-export" aria-label={tr('Hisobot yuklash')} title={tr('Hisobot yuklash')} {...props}>
              <span className="export-label">{tr('Yuklab olish')}</span>
            </Button>
          )}
          sections={exportSections}
        />
        )}
        <ProfileMenu />
      </div>
    </header>
  )
}
