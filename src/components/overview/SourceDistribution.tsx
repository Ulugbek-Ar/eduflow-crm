import { SOURCE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { CustomerSource } from '../../types/customer.types'

const SOURCES = Object.keys(SOURCE_LABELS) as CustomerSource[]

export function SourceDistribution() {
  const { customers } = useDashboard()
  const total = customers.length

  const rows = SOURCES.map((source) => {
    const count = customers.filter((c) => c.source === source).length
    return { source, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }
  }).sort((a, b) => b.count - a.count)

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Mijozlar manbasi</h2>
          <span className="muted">Jami {total} ta mijoz</span>
        </div>
      </div>
      <ul className="progress-list">
        {rows.map((row) => (
          <li key={row.source}>
            <div className="progress-meta">
              <span>{SOURCE_LABELS[row.source]}</span>
              <span className="muted">
                {row.count} ta · {row.percent}%
              </span>
            </div>
            <div className="progress">
              <div className="progress-fill" style={{ width: `${row.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
