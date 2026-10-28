import { DATE_RANGE_LABELS, Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { formatNumber, isInRange } from '../../utils/format'

interface Kpi {
  label: string
  value: string
  hint: string
  icon: IconName
  tone: 'primary' | 'success'
}

export function KpiCards() {
  const { customers, transactions, dateRange, money } = useDashboard()
  const period = DATE_RANGE_LABELS[dateRange].toLowerCase()

  const revenue = transactions
    .filter((t) => t.type === 'income' && isInRange(t.date, dateRange))
    .reduce((sum, t) => sum + t.amount, 0)
  const newCustomers = customers.filter((c) => isInRange(c.createdAt, dateRange))
  const activeCount = customers.filter((c) => c.status === 'active').length
  // Konversiya: davrda kelgan mijozlardan lead bosqichidan o'tganlar ulushi
  const converted = newCustomers.filter((c) => c.status !== 'lead').length
  const conversion = newCustomers.length > 0 ? Math.round((converted / newCustomers.length) * 100) : 0

  const kpis: Kpi[] = [
    { label: 'Tushum', value: money(revenue), hint: `Davr: ${period}`, icon: 'trendUp', tone: 'success' },
    { label: 'Yangi mijozlar', value: formatNumber(newCustomers.length), hint: `Davr: ${period}`, icon: 'userPlus', tone: 'primary' },
    { label: 'Faol mijozlar', value: formatNumber(activeCount), hint: `Jami ${customers.length} ta mijozdan`, icon: 'userCheck', tone: 'primary' },
    { label: 'Konversiya', value: `${conversion}%`, hint: `Lead → faol: ${converted} / ${newCustomers.length}`, icon: 'percent', tone: 'success' },
  ]

  return (
    <div className="kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="card kpi">
          <span className={`kpi-icon tone-${kpi.tone}`}>
            <Icon name={kpi.icon} size={20} />
          </span>
          <div>
            <small>{kpi.label}</small>
            <strong>{kpi.value}</strong>
            <span className="muted">{kpi.hint}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
