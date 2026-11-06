import { tr } from '../../i18n'
import { METHOD_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { computeDebts, pendingPayments, totalDebt } from '../../utils/debts'
import { Button } from '../ui/Button'
import { Hint } from '../ui/Hint'

// Qarzdorliklar (joriy oy) va "Kutilmoqda" statusidagi to'lovlar. Hisob qoidasi: src/utils/debts.ts
export function DebtsCard() {
  const { customers, courses, transactions, money, formatDate, openModal, updateTransaction, getCustomerName } = useDashboard()
  const can = useCan()
  const debts = computeDebts(customers, courses, transactions)
  const pending = pendingPayments(transactions)

  return (
    <section className="card" aria-labelledby="debts-title">
      <div className="card-head">
        <div>
          <div className="title-row">
            <h2 id="debts-title">{tr('Qarzdorliklar va kutilayotgan to\'lovlar')}</h2>
            <Hint term="debt" />
          </div>
          <span className="muted">
            {tr('Joriy oy ·')} {debts.length} {tr('ta qarzdor, jami')} <strong className="text-danger">{money(totalDebt(debts))}</strong>
          </span>
        </div>
      </div>

      {debts.length === 0 ? (
        <p className="muted">{tr('Joriy oy uchun qarzdorlik yo\'q.')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table" aria-label={tr('Qarzdorlar')}>
            <thead>
              <tr>
                <th scope="col">{tr('Mijoz')}</th>
                <th scope="col">{tr('Kurs')}</th>
                <th scope="col" className="align-right">
                  {tr('Kutilgan')}
                </th>
                <th scope="col" className="align-right">
                  {tr('To\'langan')}
                </th>
                <th scope="col" className="align-right">
                  {tr('Qarz')}
                </th>
                <th scope="col">
                  <span className="sr-only">{tr('Amallar')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {debts.map((row) => (
                <tr key={row.customer.id}>
                  <td data-label={tr('Mijoz')}>
                    <button type="button" className="link-btn" onClick={() => openModal({ type: 'customerDetail', payload: { id: row.customer.id } })}>
                      {row.customer.name}
                    </button>
                    {row.pending > 0 && <small className="cell-sub">{tr('Kutilmoqda:')} {money(row.pending)}</small>}
                  </td>
                  <td data-label={tr('Kurs')}>{row.course.name}</td>
                  <td data-label={tr('Kutilgan')} className="align-right nowrap">
                    {money(row.expected)}
                  </td>
                  <td data-label={tr('To\'langan')} className="align-right nowrap">
                    {money(row.paid)}
                  </td>
                  <td data-label={tr('Qarz')} className="align-right nowrap strong text-danger">
                    {money(row.debt)}
                  </td>
                  <td className="cell-actions">
                    {can('payments.create') && (
                    <Button
                      size="sm"
                      icon="plus"
                      aria-label={tr('{0}: to\'lov qabul qilish', { 0: row.customer.name })}
                      onClick={() => openModal({ type: 'transaction', payload: { kind: 'income', customerId: row.customer.id, amount: row.debt } })}
                    >
                      <span className="hide-mobile">{tr('To\'lov qabul qilish')}</span>
                      <span className="show-mobile">{tr('To\'lov')}</span>
                    </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="detail-subtitle">{tr('Kutilayotgan to\'lovlar (')}{pending.length})</h3>
      {pending.length === 0 ? (
        <p className="muted">{tr('"Kutilmoqda" statusidagi to\'lov yo\'q.')}</p>
      ) : (
        <ul className="pending-list">
          {pending.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.customerId ? getCustomerName(t.customerId) : t.note || tr('To\'lov')}</strong>
                <small className="muted">
                  {formatDate(t.date)} · {METHOD_LABELS[t.method]}
                  {t.note && t.customerId ? ` · ${t.note}` : ''}
                </small>
              </div>
              <strong className="nowrap">{money(t.amount)}</strong>
              {can('payments.manage') && (
                <Button size="sm" variant="ghost" icon="check" onClick={() => updateTransaction(t.id, { status: 'paid', date: new Date().toISOString() })}>
                  {tr('To\'landi')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
