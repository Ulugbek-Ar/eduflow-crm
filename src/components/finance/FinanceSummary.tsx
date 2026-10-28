import { CATEGORY_LABELS, EXPENSE_CATEGORIES, METHOD_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { PaymentMethod, Transaction } from '../../types/finance.types'
import { breakdown, sumExpense, sumIncome } from '../../utils/analytics'
import type { BreakdownRow } from '../../utils/analytics'
import { cx } from '../../utils/cx'

const METHODS = Object.keys(METHOD_LABELS) as PaymentMethod[]

interface BreakdownCardProps<K extends string> {
  title: string
  subtitle: string
  rows: BreakdownRow<K>[]
  labels: Record<K, string>
  tone: 'success' | 'danger'
}

function BreakdownCard<K extends string>({ title, subtitle, rows, labels, tone }: BreakdownCardProps<K>) {
  const { money } = useDashboard()
  const visible = rows.filter((r) => r.total > 0)
  return (
    <section className="card" aria-label={title}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          <span className="muted">{subtitle}</span>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="muted">Bu davrda ma'lumot yo'q</p>
      ) : (
        <ul className="progress-list">
          {visible.map((row) => (
            <li key={row.key}>
              <div className="progress-meta">
                <span>{labels[row.key]}</span>
                <span className="muted">
                  {money(row.total)} · {Math.round(row.share)}%
                </span>
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-label={labels[row.key]}
                aria-valuenow={Math.round(row.share)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={cx('progress-fill', `fill-${tone}`)} style={{ width: `${row.share}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function FinanceSummary({ transactions, periodLabel }: { transactions: Transaction[]; periodLabel: string }) {
  const { money } = useDashboard()
  const income = sumIncome(transactions)
  const expense = sumExpense(transactions)
  const net = income - expense
  const incomes = transactions.filter((t) => t.type === 'income')
  const expenses = transactions.filter((t) => t.type === 'expense')

  return (
    <>
      <div className="summary-grid">
        <div className="card summary">
          <small>Kirim · {periodLabel}</small>
          <strong className="text-success">{money(income)}</strong>
        </div>
        <div className="card summary">
          <small>Chiqim · {periodLabel}</small>
          <strong className="text-danger">{money(expense)}</strong>
        </div>
        <div className="card summary">
          <small>Sof natija · {periodLabel}</small>
          <strong className={net < 0 ? 'text-danger' : undefined}>{money(net)}</strong>
        </div>
      </div>
      <div className="split-grid">
        <BreakdownCard
          title="To'lov usullari"
          subtitle="Kirimlar qaysi usulda tushgan"
          rows={breakdown(incomes, METHODS, (t) => t.method)}
          labels={METHOD_LABELS}
          tone="success"
        />
        <BreakdownCard
          title="Xarajatlar tarkibi"
          subtitle="Chiqimlar kategoriyalar bo'yicha"
          rows={breakdown(expenses, EXPENSE_CATEGORIES, (t) => t.category)}
          labels={CATEGORY_LABELS}
          tone="danger"
        />
      </div>
    </>
  )
}
