import { DATE_RANGE_LABELS, SOURCE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { CustomerSource } from '../../types/customer.types'
import { filterByPeriod, getPeriod, sourceStats } from '../../utils/analytics'

const SOURCES = Object.keys(SOURCE_LABELS) as CustomerSource[]

export function SourceDistribution() {
  const { customers, dateRange } = useDashboard()
  const inPeriod = filterByPeriod(customers, (c) => c.createdAt, getPeriod(dateRange))
  const rows = sourceStats(inPeriod, SOURCES)

  return (
    <section className="card" aria-labelledby="sources-title">
      <div className="card-head">
        <div>
          <h2 id="sources-title">Mijozlar manbasi</h2>
          <span className="muted">
            {DATE_RANGE_LABELS[dateRange]} · {inPeriod.length} ta yangi mijoz
          </span>
        </div>
      </div>
      {inPeriod.length === 0 ? (
        <p className="muted">Bu davrda yangi mijoz qo'shilmagan.</p>
      ) : (
        <ul className="progress-list">
          {rows.map((row) => (
            <li key={row.source}>
              <div className="progress-meta">
                <span>{SOURCE_LABELS[row.source]}</span>
                <span className="muted">
                  {row.count} ta · {Math.round(row.share)}%
                </span>
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-label={`${SOURCE_LABELS[row.source]} ulushi`}
                aria-valuenow={Math.round(row.share)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="progress-fill" style={{ width: `${row.share}%` }} />
              </div>
              <small className="source-conversion">
                Konversiya: {row.conversion === null ? '—' : `${Math.round(row.conversion)}%`}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
