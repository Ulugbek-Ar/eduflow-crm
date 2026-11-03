import { DATE_RANGE_LABELS, Icon, SOURCE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { exportRows } from '../../services/export.service'
import type { ExportFormat } from '../../services/export.service'
import type { CustomerSource } from '../../types/customer.types'
import { averageOrderValue, conversion, filterByPeriod, getPeriod, sourcePerformance, sumExpense, totalPerformance } from '../../utils/analytics'
import { computeDebts } from '../../utils/debts'
import { formatNumber, formatPercent } from '../../utils/format'
import { customerColumns, debtColumns, sourceColumns, transactionColumns } from '../../utils/reports'
import { Button } from '../ui/Button'

const SOURCES = Object.keys(SOURCE_LABELS) as CustomerSource[]

interface ReportDef {
  id: string
  title: string
  description: string
  download: (format: ExportFormat) => void
}

export function AnalyticsPanel() {
  const { customers, transactions, courses, dateRange, money, formatDate, getCustomerName, settings } = useDashboard()
  const period = getPeriod(dateRange)
  const periodLabel = DATE_RANGE_LABELS[dateRange]
  const txInPeriod = filterByPeriod(transactions, (t) => t.date, period)
  const leadsInPeriod = filterByPeriod(customers, (c) => c.createdAt, period)
  const aov = averageOrderValue(txInPeriod)
  const rows = sourcePerformance(customers, transactions, SOURCES, period)
  const total = totalPerformance(rows)
  const marketing = sumExpense(txInPeriod.filter((t) => t.category === 'marketing'))
  const overallConversion = conversion(leadsInPeriod)

  const percent = (value: number | null) => (value === null ? '—' : formatPercent(value))
  const signedPercent = (value: number | null) => (value === null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatPercent(Math.abs(value))}`)
  const optionalMoney = (value: number | null) => (value === null ? '—' : money(Math.round(value)))

  // Eksport export.service orqali: CSV injection himoyasi (=, +, -, @) va UTF-8 BOM saqlanadi
  const options = (sheetName: string) => ({ delimiter: settings.csvDelimiter, sheetName })
  const reports: ReportDef[] = [
    {
      id: 'customers',
      title: 'Mijozlar',
      description: 'Barcha mijozlar va lidlar',
      download: (format) => exportRows('mijozlar', customers, customerColumns(formatDate), format, options('Mijozlar')),
    },
    {
      id: 'transactions',
      title: 'Tranzaksiyalar',
      description: `${periodLabel} · barcha statuslar`,
      download: (format) => exportRows('tranzaksiyalar', txInPeriod, transactionColumns(formatDate, getCustomerName), format, options('Tranzaksiyalar')),
    },
    {
      id: 'debtors',
      title: 'Qarzdorlar',
      description: 'Joriy oy · qarzi kattasidan',
      download: (format) => exportRows('qarzdorlar', computeDebts(customers, courses, transactions), debtColumns(), format, options('Qarzdorlar')),
    },
    {
      id: 'sources',
      title: 'Manbalar hisoboti',
      description: `${periodLabel} · CPL va ROI`,
      download: (format) => exportRows('manbalar', rows, sourceColumns(), format, options('Manbalar')),
    },
  ]

  return (
    <div className="stack">
      <section className="kpi-grid" aria-label={`Tahlil ko'rsatkichlari: ${periodLabel.toLowerCase()}`}>
        <article className="card kpi">
          <span className="kpi-icon tone-primary">
            <Icon name="receipt" size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">O'rtacha chek (AOV)</h2>
            <strong>{optionalMoney(aov.value)}</strong>
            <span className="kpi-foot muted">{aov.count} ta to'langan to'lov</span>
          </div>
        </article>
        <article className="card kpi">
          <span className="kpi-icon tone-success">
            <Icon name="trendUp" size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">To'langan kirim</h2>
            <strong>{money(aov.total)}</strong>
            <span className="kpi-foot muted">{periodLabel}</span>
          </div>
        </article>
        <article className="card kpi">
          <span className="kpi-icon tone-danger">
            <Icon name="activity" size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">Marketing chiqimi</h2>
            <strong>{money(marketing)}</strong>
            <span className="kpi-foot muted">Umumiy CPL: {optionalMoney(total.cpl)}</span>
          </div>
        </article>
        <article className="card kpi">
          <span className="kpi-icon tone-primary">
            <Icon name="percent" size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">Konversiya</h2>
            <strong>{overallConversion === null ? '—' : `${Math.round(overallConversion)}%`}</strong>
            <span className="kpi-foot muted">{formatNumber(leadsInPeriod.length)} ta liddan</span>
          </div>
        </article>
      </section>

      <section className="card" aria-labelledby="sources-perf-title">
        <div className="card-head">
          <div>
            <h2 id="sources-perf-title">Manbalar samaradorligi</h2>
            <span className="muted">{periodLabel} · faqat to'langan tranzaksiyalar</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table" aria-label="Manbalar samaradorligi">
            <thead>
              <tr>
                <th scope="col">Manba</th>
                <th scope="col" className="align-right">
                  Lidlar
                </th>
                <th scope="col" className="align-right">
                  To'lov qildi
                </th>
                <th scope="col" className="align-right">
                  Konversiya
                </th>
                <th scope="col" className="align-right">
                  Marketing chiqimi
                </th>
                <th scope="col" className="align-right">
                  CPL
                </th>
                <th scope="col" className="align-right">
                  ROI
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source}>
                  <td data-label="Manba" className="strong">
                    {SOURCE_LABELS[row.source]}
                  </td>
                  <td data-label="Lidlar" className="align-right">
                    {row.leads}
                  </td>
                  <td data-label="To'lov qildi" className="align-right">
                    {row.paid}
                  </td>
                  <td data-label="Konversiya" className="align-right">
                    {percent(row.conversion)}
                  </td>
                  <td data-label="Marketing chiqimi" className="align-right nowrap">
                    {money(row.spend)}
                  </td>
                  <td data-label="CPL" className="align-right nowrap">
                    {optionalMoney(row.cpl)}
                  </td>
                  <td data-label="ROI" className={`align-right nowrap ${row.roi === null ? '' : row.roi >= 0 ? 'text-success' : 'text-danger'}`}>
                    {signedPercent(row.roi)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-total">
                <th scope="row" data-label="Manba">
                  Jami
                </th>
                <td data-label="Lidlar" className="align-right">
                  {total.leads}
                </td>
                <td data-label="To'lov qildi" className="align-right">
                  {total.paid}
                </td>
                <td data-label="Konversiya" className="align-right">
                  {percent(total.conversion)}
                </td>
                <td data-label="Marketing chiqimi" className="align-right nowrap">
                  {money(total.spend)}
                </td>
                <td data-label="CPL" className="align-right nowrap">
                  {optionalMoney(total.cpl)}
                </td>
                <td data-label="ROI" className="align-right nowrap">
                  {signedPercent(total.roi)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="field-hint formula-note">
          CPL = marketing chiqimi / lidlar soni. ROI = (shu manbadan kelgan mijozlarning kirimi − chiqim) / chiqim × 100.
          Chiqim 0 bo'lsa "—". Marketing chiqimiga manba Moliya va kassa'da xarajat yozishda tanlanadi.
        </p>
      </section>

      <section className="card" aria-labelledby="reports-title">
        <div className="card-head">
          <div>
            <h2 id="reports-title">Hisobotlarni yuklab olish</h2>
            <span className="muted">CSV (Excel UZ/RU uchun ajratgich Sozlamalarda) yoki Excel (.xls)</span>
          </div>
        </div>
        <ul className="report-list">
          {reports.map((report) => (
            <li key={report.id}>
              <div>
                <strong>{report.title}</strong>
                <small className="muted">{report.description}</small>
              </div>
              <div className="toolbar">
                <Button size="sm" variant="ghost" icon="fileText" aria-label={`${report.title} — CSV`} onClick={() => report.download('csv')}>
                  CSV
                </Button>
                <Button size="sm" variant="ghost" icon="sheet" aria-label={`${report.title} — Excel`} onClick={() => report.download('xls')}>
                  Excel
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
