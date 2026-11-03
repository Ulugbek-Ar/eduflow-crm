import { METHOD_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { computeDebts, pendingPayments, totalDebt } from '../../utils/debts'
import { Button } from '../ui/Button'

// Qarzdorliklar (joriy oy) va "Kutilmoqda" statusidagi to'lovlar. Hisob qoidasi: src/utils/debts.ts
export function DebtsCard() {
  const { customers, courses, transactions, money, formatDate, openModal, updateTransaction, getCustomerName } = useDashboard()
  const debts = computeDebts(customers, courses, transactions)
  const pending = pendingPayments(transactions)

  return (
    <section className="card" aria-labelledby="debts-title">
      <div className="card-head">
        <div>
          <h2 id="debts-title">Qarzdorliklar va kutilayotgan to'lovlar</h2>
          <span className="muted">
            Joriy oy · {debts.length} ta qarzdor, jami <strong className="text-danger">{money(totalDebt(debts))}</strong>
          </span>
        </div>
      </div>

      {debts.length === 0 ? (
        <p className="muted">Joriy oy uchun qarzdorlik yo'q.</p>
      ) : (
        <div className="table-wrap">
          <table className="table" aria-label="Qarzdorlar">
            <thead>
              <tr>
                <th scope="col">Mijoz</th>
                <th scope="col">Kurs</th>
                <th scope="col" className="align-right">
                  Kutilgan
                </th>
                <th scope="col" className="align-right">
                  To'langan
                </th>
                <th scope="col" className="align-right">
                  Qarz
                </th>
                <th scope="col">
                  <span className="sr-only">Amallar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {debts.map((row) => (
                <tr key={row.customer.id}>
                  <td data-label="Mijoz">
                    <button type="button" className="link-btn" onClick={() => openModal({ type: 'customerDetail', payload: { id: row.customer.id } })}>
                      {row.customer.name}
                    </button>
                    {row.pending > 0 && <small className="cell-sub">Kutilmoqda: {money(row.pending)}</small>}
                  </td>
                  <td data-label="Kurs">{row.course.name}</td>
                  <td data-label="Kutilgan" className="align-right nowrap">
                    {money(row.expected)}
                  </td>
                  <td data-label="To'langan" className="align-right nowrap">
                    {money(row.paid)}
                  </td>
                  <td data-label="Qarz" className="align-right nowrap strong text-danger">
                    {money(row.debt)}
                  </td>
                  <td className="cell-actions">
                    <Button
                      size="sm"
                      icon="plus"
                      aria-label={`${row.customer.name}: to'lov qabul qilish`}
                      onClick={() => openModal({ type: 'transaction', payload: { kind: 'income', customerId: row.customer.id, amount: row.debt } })}
                    >
                      <span className="hide-mobile">To'lov qabul qilish</span>
                      <span className="show-mobile">To'lov</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="detail-subtitle">Kutilayotgan to'lovlar ({pending.length})</h3>
      {pending.length === 0 ? (
        <p className="muted">"Kutilmoqda" statusidagi to'lov yo'q.</p>
      ) : (
        <ul className="pending-list">
          {pending.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.customerId ? getCustomerName(t.customerId) : t.note || 'To\'lov'}</strong>
                <small className="muted">
                  {formatDate(t.date)} · {METHOD_LABELS[t.method]}
                  {t.note && t.customerId ? ` · ${t.note}` : ''}
                </small>
              </div>
              <strong className="nowrap">{money(t.amount)}</strong>
              <Button size="sm" variant="ghost" icon="check" onClick={() => updateTransaction(t.id, { status: 'paid' })}>
                To'landi
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
