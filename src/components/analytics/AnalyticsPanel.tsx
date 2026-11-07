import { tr } from '../../i18n'
import { DATE_RANGE_LABELS, FUNNEL_STAGES, Icon, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { exportRows } from '../../services/export.service'
import type { ExportFormat } from '../../services/export.service'
import type { CustomerSource } from '../../types/customer.types'
import {
  averageOrderValue,
  conversion,
  courseRevenue,
  filterByPeriod,
  funnelStats,
  getPeriod,
  safeRatio,
  sourcePerformance,
  sumExpense,
  totalPerformance,
} from '../../utils/analytics'
import { computeDebts } from '../../utils/debts'
import { formatNumber, formatPercent } from '../../utils/format'
import { customerColumns, debtColumns, sourceColumns, transactionColumns } from '../../utils/reports'
import { Button } from '../ui/Button'
import { Hint } from '../ui/Hint'

const SOURCES = Object.keys(SOURCE_LABELS) as CustomerSource[]

interface ReportDef {
  id: string
  title: string
  description: string
  download: (format: ExportFormat) => void
}

export function AnalyticsPanel() {
  const { customers, transactions, courses, dateRange, money, formatDate, getCustomerName, settings, logExport, debtContext } = useDashboard()
  const canExport = useCan()('reports.export')
  const period = getPeriod(dateRange)
  const periodLabel = DATE_RANGE_LABELS[dateRange]
  const txInPeriod = filterByPeriod(transactions, (t) => t.date, period)
  const leadsInPeriod = filterByPeriod(customers, (c) => c.createdAt, period)
  const aov = averageOrderValue(txInPeriod)
  const rows = sourcePerformance(customers, transactions, SOURCES, period)
  const total = totalPerformance(rows)
  // Barcha marketing chiqimi (manbasi ko'rsatilmaganlari ham) — umumiy CPL shundan; jadvalga faqat manbalilar kiradi
  const marketing = sumExpense(txInPeriod.filter((t) => t.category === 'marketing'))
  const unattributed = marketing - total.spend
  const overallCpl = marketing > 0 ? safeRatio(marketing, leadsInPeriod.length) : null
  const overallConversion = conversion(leadsInPeriod)
  const funnel = funnelStats(customers, FUNNEL_STAGES, period)
  const byCourse = courseRevenue(customers, courses, transactions, period)

  const percent = (value: number | null) => (value === null ? '—' : formatPercent(value))
  const signedPercent = (value: number | null) => (value === null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatPercent(Math.abs(value))}`)
  const optionalMoney = (value: number | null) => (value === null ? '—' : money(Math.round(value)))

  // Eksport export.service orqali: CSV injection himoyasi (=, +, -, @) va UTF-8 BOM saqlanadi
  const options = (sheetName: string) => ({ delimiter: settings.csvDelimiter, sheetName })
  const reports: ReportDef[] = [
    {
      id: 'customers',
      title: tr('Mijozlar'),
      description: tr('Barcha mijozlar va lidlar'),
      download: (format) => exportRows('mijozlar', customers, customerColumns(formatDate), format, options('Mijozlar')),
    },
    {
      id: 'transactions',
      title: tr('Tranzaksiyalar'),
      description: tr('{0} · barcha statuslar', { 0: periodLabel }),
      download: (format) => exportRows('tranzaksiyalar', txInPeriod, transactionColumns(formatDate, getCustomerName), format, options('Tranzaksiyalar')),
    },
    {
      id: 'debtors',
      title: tr('Qarzdorlar'),
      description: tr('Joriy oy · qarzi kattasidan'),
      download: (format) => exportRows('qarzdorlar', computeDebts(customers, courses, transactions, undefined, debtContext), debtColumns(), format, options('Qarzdorlar')),
    },
    {
      id: 'sources',
      title: tr('Manbalar hisoboti'),
      description: tr('{0} · CPL va ROI', { 0: periodLabel }),
      download: (format) => exportRows('manbalar', rows, sourceColumns(), format, options('Manbalar')),
    },
  ]

  return (
    <div className="stack">
      <section className="kpi-grid" aria-label={tr('Tahlil ko\'rsatkichlari: {0}', { 0: periodLabel.toLowerCase() })}>
        <article className="card kpi">
          <span className="kpi-icon tone-primary">
            <Icon name="receipt" size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">{tr('O\'rtacha chek (AOV)')}</h2>
            <strong>{optionalMoney(aov.value)}</strong>
            <span className="kpi-foot muted">{aov.count} {tr('ta to\'langan to\'lov')}</span>
          </div>
          <Hint term="aov" className="kpi-hint" />
        </article>
        <article className="card kpi">
          <span className="kpi-icon tone-success">
            <Icon name="trendUp" size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">{tr('To\'langan kirim')}</h2>
            <strong>{money(aov.total)}</strong>
            <span className="kpi-foot muted">{periodLabel}</span>
          </div>
        </article>
        <article className="card kpi">
          <span className="kpi-icon tone-danger">
            <Icon name="activity" size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">{tr('Marketing chiqimi')}</h2>
            <strong>{money(marketing)}</strong>
            <span className="kpi-foot muted">{tr('Umumiy CPL:')} {optionalMoney(overallCpl)}</span>
          </div>
          <Hint term="cpl" className="kpi-hint" />
        </article>
        <article className="card kpi">
          <span className="kpi-icon tone-primary">
            <Icon name="percent" size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">{tr('Konversiya')}</h2>
            <strong>{overallConversion === null ? '—' : `${Math.round(overallConversion)}%`}</strong>
            <span className="kpi-foot muted">{formatNumber(leadsInPeriod.length)} {tr('ta liddan')}</span>
          </div>
          <Hint term="conversion" className="kpi-hint" />
        </article>
      </section>

      <div className="split-grid">
        <section className="card" aria-labelledby="funnel-title">
          <div className="card-head">
            <div>
              <div className="title-row">
                <h2 id="funnel-title">{tr('Sotuv voronkasi')}</h2>
                <Hint term="funnel" />
              </div>
              <span className="muted">
                {periodLabel} {tr('kelgan')} {leadsInPeriod.length} {tr('ta lid hozir qaysi bosqichda')}
              </span>
            </div>
          </div>
          {leadsInPeriod.length === 0 ? (
            <p className="muted">{tr('Bu davrda lid kelmagan.')}</p>
          ) : (
            <ul className="progress-list">
              {funnel.map((row) => (
                <li key={row.stage}>
                  <div className="progress-meta">
                    <span>
                      <span className={`stage-dot stage-${row.stage}`} aria-hidden="true" /> {STATUS_LABELS[row.stage]}
                    </span>
                    <span className="muted">
                      {row.count} {tr('ta ·')} {Math.round(row.share)}%
                    </span>
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label={tr('{0} ulushi', { 0: STATUS_LABELS[row.stage] })}
                    aria-valuenow={Math.round(row.share)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className={`progress-fill stage-${row.stage}`} style={{ width: `${row.share}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="course-revenue-title">
          <div className="card-head">
            <div>
              <h2 id="course-revenue-title">{tr('Kurslar bo\'yicha tushum')}</h2>
              <span className="muted">{periodLabel} {tr('· to\'langan kirimlar')}</span>
            </div>
          </div>
          {byCourse.length === 0 ? (
            <p className="muted">{tr('Kurs qo\'shilmagan.')}</p>
          ) : (
            <div className="table-wrap">
              <table className="table" aria-label={tr('Kurslar bo\'yicha tushum')}>
                <thead>
                  <tr>
                    <th scope="col">{tr('Kurs')}</th>
                    <th scope="col" className="align-right">
                      {tr('Talabalar')}
                    </th>
                    <th scope="col" className="align-right">
                      {tr('Tushum')}
                    </th>
                    <th scope="col" className="align-right">
                      {tr('Oylik kutilgan')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byCourse.map((row) => (
                    <tr key={row.course.id}>
                      <td data-label={tr('Kurs')}>{row.course.name}</td>
                      <td data-label={tr('Talabalar')} className="align-right">
                        {row.students}
                      </td>
                      <td data-label={tr('Tushum')} className="align-right nowrap strong">
                        {money(row.revenue)}
                      </td>
                      <td data-label={tr('Oylik kutilgan')} className="align-right nowrap">
                        {money(row.expectedMonthly)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="sources-perf-title">
        <div className="card-head">
          <div>
            <h2 id="sources-perf-title">{tr('Manbalar samaradorligi')}</h2>
            <span className="muted">{periodLabel} {tr('· faqat to\'langan tranzaksiyalar')}</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table" aria-label={tr('Manbalar samaradorligi')}>
            <thead>
              <tr>
                <th scope="col">{tr('Manba')}</th>
                <th scope="col" className="align-right">
                  {tr('Lidlar')}
                </th>
                <th scope="col" className="align-right">
                  {tr('To\'lov qildi')}
                </th>
                <th scope="col" className="align-right">
                  {tr('Konversiya')}
                </th>
                <th scope="col" className="align-right">
                  {tr('Marketing chiqimi')}
                </th>
                <th scope="col" className="align-right">
                  {tr('CPL')} <Hint term="cpl" />
                </th>
                <th scope="col" className="align-right">
                  {tr('ROI')} <Hint term="roi" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source}>
                  <td data-label={tr('Manba')} className="strong">
                    {SOURCE_LABELS[row.source]}
                  </td>
                  <td data-label={tr('Lidlar')} className="align-right">
                    {row.leads}
                  </td>
                  <td data-label={tr('To\'lov qildi')} className="align-right">
                    {row.paid}
                  </td>
                  <td data-label={tr('Konversiya')} className="align-right">
                    {percent(row.conversion)}
                  </td>
                  <td data-label={tr('Marketing chiqimi')} className="align-right nowrap">
                    {money(row.spend)}
                  </td>
                  <td data-label={tr('CPL')} className="align-right nowrap">
                    {optionalMoney(row.cpl)}
                  </td>
                  <td data-label={tr('ROI')} className={`align-right nowrap ${row.roi === null ? '' : row.roi >= 0 ? 'text-success' : 'text-danger'}`}>
                    {signedPercent(row.roi)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-total">
                <th scope="row" data-label={tr('Manba')}>
                  {tr('Jami')}
                </th>
                <td data-label={tr('Lidlar')} className="align-right">
                  {total.leads}
                </td>
                <td data-label={tr('To\'lov qildi')} className="align-right">
                  {total.paid}
                </td>
                <td data-label={tr('Konversiya')} className="align-right">
                  {percent(total.conversion)}
                </td>
                <td data-label={tr('Marketing chiqimi')} className="align-right nowrap">
                  {money(total.spend)}
                </td>
                <td data-label={tr('CPL')} className="align-right nowrap">
                  {optionalMoney(total.cpl)}
                </td>
                <td data-label={tr('ROI')} className="align-right nowrap">
                  {signedPercent(total.roi)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {unattributed > 0 && (
          <p className="notice notice-warning formula-note">
            {tr('Manbasi ko\'rsatilmagan marketing chiqimi:')} {money(unattributed)} {tr('— u jadvaldagi CPL va ROI ga kirmaydi. Xarajatni tahrirlab manbasini tanlang.')}
          </p>
        )}
        <p className="field-hint formula-note">
          {tr('CPL = marketing chiqimi / lidlar soni. ROI = (shu manbadan kelgan mijozlarning kirimi − chiqim) / chiqim × 100. Chiqim 0 bo\'lsa "—". Marketing chiqimiga manba Moliya va kassa\'da xarajat yozishda tanlanadi.')}
        </p>
      </section>

      {canExport && (
      <section className="card" aria-labelledby="reports-title">
        <div className="card-head">
          <div>
            <h2 id="reports-title">{tr('Hisobotlarni yuklab olish')}</h2>
            <span className="muted">{tr('CSV (Excel UZ/RU uchun ajratgich Sozlamalarda) yoki Excel (.xls)')}</span>
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
                <Button
                  size="sm"
                  variant="ghost"
                  icon="fileText"
                  aria-label={tr('{0} — CSV', { 0: report.title })}
                  onClick={() => {
                    report.download('csv')
                    logExport(`${report.title} — CSV`)
                  }}
                >
                  {tr('CSV')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="sheet"
                  aria-label={tr('{0} — Excel', { 0: report.title })}
                  onClick={() => {
                    report.download('xls')
                    logExport(`${report.title} — Excel`)
                  }}
                >
                  {tr('Excel')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      )}
    </div>
  )
}
