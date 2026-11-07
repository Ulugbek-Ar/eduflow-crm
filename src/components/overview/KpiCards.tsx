import { tr } from '../../i18n'
import { DATE_RANGE_LABELS, Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import type { GlossaryKey } from '../../constants/glossary'
import { useDashboard } from '../../context/useDashboard'
import { overviewKpis } from '../../utils/analytics'
import { cx } from '../../utils/cx'
import { formatNumber, formatPercent } from '../../utils/format'
import { Hint } from '../ui/Hint'

interface Kpi {
  label: string
  value: string
  change: number | null
  unit: '%' | 'p.b.'
  hint: string
  icon: IconName
  tone: 'primary' | 'success'
  glossary?: GlossaryKey
}

function TrendBadge({ change, unit }: { change: number | null; unit: Kpi['unit'] }) {
  if (change === null) {
    return (
      <span className="trend trend-flat" title={tr('Oldingi davrda ma\'lumot yo\'q')}>
        —
      </span>
    )
  }
  const direction = change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'flat'
  const formatted = unit === '%' ? formatPercent(Math.abs(change)) : tr('{0} f.b.', { 0: formatPercent(Math.abs(change)).replace('%', '') })
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : ''
  return (
    <span className={cx('trend', `trend-${direction}`)}>
      {direction !== 'flat' && <Icon name={direction === 'up' ? 'arrowUpRight' : 'arrowDownRight'} size={14} />}
      <span className="sr-only">{direction === 'up' ? tr('O\'sish') : direction === 'down' ? tr('Pasayish') : tr('O\'zgarishsiz')}:</span>
      {sign}
      {formatted}
    </span>
  )
}

export function KpiCards() {
  const { customers, transactions, enrollments, dateRange, money } = useDashboard()
  const k = overviewKpis(customers, transactions, dateRange, undefined, enrollments)

  const kpis: Kpi[] = [
    {
      label: tr('Jami tushum'),
      value: money(k.revenue.value),
      change: k.revenue.change,
      unit: '%',
      hint: tr('faqat to\'langan · oldingi davrga nisbatan'),
      icon: 'trendUp',
      tone: 'success',
    },
    {
      label: tr('Faol mijozlar'),
      value: formatNumber(k.active.value),
      change: k.active.change,
      unit: '%',
      hint: enrollments.length > 0 ? tr('guruhlarda o\'qiyotganlar') : tr('"To\'lov qildi" bosqichida'),
      icon: 'userCheck',
      tone: 'primary',
    },
    {
      label: tr('Yangi lidlar'),
      value: formatNumber(k.newLeads.value),
      change: k.newLeads.change,
      unit: '%',
      hint: tr('davrda kelgan · oldingi davrga nisbatan'),
      icon: 'userPlus',
      tone: 'primary',
      glossary: 'lead',
    },
    {
      label: tr('Konversiya'),
      value: k.conversion.value === null ? '—' : `${Math.round(k.conversion.value)}%`,
      change: k.conversion.change,
      unit: 'p.b.',
      hint: tr('davr lidlaridan → to\'lov qildi'),
      icon: 'percent',
      tone: 'success',
      glossary: 'conversion',
    },
  ]
  return (
    <section className="kpi-grid" aria-label={tr('Asosiy ko\'rsatkichlar: {0}', { 0: DATE_RANGE_LABELS[dateRange].toLowerCase() })}>
      {kpis.map((kpi) => (
        <article key={kpi.label} className="card kpi">
          <span className={`kpi-icon tone-${kpi.tone}`}>
            <Icon name={kpi.icon} size={20} />
          </span>
          <div className="kpi-body">
            <h2 className="kpi-title">{kpi.label}</h2>
            <strong>{kpi.value}</strong>
            <span className="kpi-foot">
              <TrendBadge change={kpi.change} unit={kpi.unit} />
              <span className="muted">{kpi.hint}</span>
            </span>
          </div>
          {kpi.glossary && <Hint term={kpi.glossary} className="kpi-hint" />}
        </article>
      ))}
    </section>
  )
}
