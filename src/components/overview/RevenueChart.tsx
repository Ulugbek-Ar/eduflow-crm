import { useDashboard } from '../../context/useDashboard'
import type { Transaction } from '../../types/finance.types'

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
const WIDTH = 600
const HEIGHT = 240
const TOP = 28
const BOTTOM = 28
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} mln`
  if (value >= 1_000) return `${Math.round(value / 1_000)} ming`
  return String(value)
}

// Joriy oy bilan birga oxirgi 6 kalendar oyi bo'yicha tushum yig'indisi
function buildMonths(transactions: Transaction[]) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const total = transactions
      .filter((t) => {
        const d = new Date(t.date)
        return t.type === 'income' && d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()
      })
      .reduce((sum, t) => sum + t.amount, 0)
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: MONTHS[date.getMonth()], total }
  })
}

export function RevenueChart() {
  const { transactions, money } = useDashboard()

  const months = buildMonths(transactions)

  const max = Math.max(...months.map((m) => m.total), 1)
  const slot = WIDTH / months.length
  const barWidth = slot * 0.5
  const sum = months.reduce((acc, m) => acc + m.total, 0)

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Oylik tushum</h2>
          <span className="muted">Oxirgi 6 oy</span>
        </div>
        <strong className="text-success">{money(sum)}</strong>
      </div>
      <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Oxirgi 6 oylik tushum grafigi">
        <line x1={0} x2={WIDTH} y1={HEIGHT - BOTTOM} y2={HEIGHT - BOTTOM} className="chart-axis" />
        {months.map((m, i) => {
          const height = (m.total / max) * PLOT_HEIGHT
          const x = i * slot + (slot - barWidth) / 2
          const y = HEIGHT - BOTTOM - height
          return (
            <g key={m.key}>
              <title>{`${m.label}: ${money(m.total)}`}</title>
              <rect x={x} y={y} width={barWidth} height={Math.max(height, 2)} rx={6} className="chart-bar" />
              <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="chart-value">
                {compact(m.total)}
              </text>
              <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="chart-label">
                {m.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
