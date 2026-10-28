import { DATE_RANGE_LABELS, Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import {
  conversion,
  filterByPeriod,
  getPeriod,
  getPreviousPeriod,
  payingCustomers,
  pointChange,
  sumIncome,
  trend,
} from '../../utils/analytics'
import { cx } from '../../utils/cx'
import { formatNumber, formatPercent } from '../../utils/format'

interface Kpi {
  label: string
  value: string
  change: number | null
  unit: '%' | 'p.b.'
  hint: string
  icon: IconName
  tone: 'primary' | 'success'
}

function TrendBadge({ change, unit }: { change: number | null; unit: Kpi['unit'] }) {
  if (change === null) {
    return (
      <span className="trend trend-flat" title="Oldingi davrda ma'lumot yo'q">
        —
      </span>
    )
  }
  const direction = change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'flat'
  const formatted = unit === '%' ? formatPercent(Math.abs(change)) : `${formatPercent(Math.abs(change)).replace('%', '')} f.b.`
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : ''
  return (
    <span className={cx('trend', `trend-${direction}`)}>
      {direction !== 'flat' && <Icon name={direction === 'up' ? 'arrowUpRight' : 'arrowDownRight'} size={14} />}
      <span className="sr-only">{direction === 'up' ? 'O\'sish' : direction === 'down' ? 'Pasayish' : 'O\'zgarishsiz'}:</span>
      {sign}
      {formatted}
    </span>
  )
}

export function KpiCards() {
  const { customers, transactions, dateRange, money } = useDashboard()
  const current = getPeriod(dateRange)
  const previous = getPreviousPeriod(dateRange)

  const txNow = filterByPeriod(transactions, (t) => t.date, current)
  const txPrev = filterByPeriod(transactions, (t) => t.date, previous)
  const newNow = filterByPeriod(customers, (c) => c.createdAt, current)
  const newPrev = filterByPeriod(customers, (c) => c.createdAt, previous)

  const revenueNow = sumIncome(txNow)
  const payingNow = payingCustomers(txNow)
  const conversionNow = conversion(newNow)
  const activeCount = customers.filter((c) => c.status === 'active').length

  const kpis: Kpi[] = [
    {
      label: 'Tushum',
      value: money(revenueNow),
      change: trend(revenueNow, sumIncome(txPrev)),
      unit: '%',
      hint: 'oldingi davrga nisbatan',
      icon: 'trendUp',
      tone: 'success',
    },
    {
      label: 'Yangi mijozlar',
      value: formatNumber(newNow.length),
      change: trend(newNow.length, newPrev.length),
      unit: '%',
      hint: 'oldingi davrga nisbatan',
      icon: 'userPlus',
      tone: 'primary',
    },
    {
      label: 'To\'lov qilgan mijozlar',
      value: formatNumber(payingNow),
      change: trend(payingNow, payingCustomers(txPrev)),
      unit: '%',
      hint: `jami faol: ${activeCount} ta`,
      icon: 'userCheck',
      tone: 'primary',
    },
    {
      label: 'Konversiya',
      value: conversionNow === null ? '—' : `${Math.round(conversionNow)}%`,
      change: pointChange(conversionNow, conversion(newPrev)),
      unit: 'p.b.',
      hint: 'lead → o\'quvchi',
      icon: 'percent',
      tone: 'success',
    },
  ]

  return (
    <section className="kpi-grid" aria-label={`Asosiy ko'rsatkichlar: ${DATE_RANGE_LABELS[dateRange].toLowerCase()}`}>
      {kpis.map((kpi) => (
        <article key={kpi.label} className="card kpi">
          <span className={`kpi-icon tone-${kpi.tone}`}>
            <Icon name={kpi.icon} size={20} />
          </span>
          <div className="kpi-body">
            <h3>{kpi.label}</h3>
            <strong>{kpi.value}</strong>
            <span className="kpi-foot">
              <TrendBadge change={kpi.change} unit={kpi.unit} />
              <span className="muted">{kpi.hint}</span>
            </span>
          </div>
        </article>
      ))}
    </section>
  )
}
