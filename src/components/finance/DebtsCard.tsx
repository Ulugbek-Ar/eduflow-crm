import { tr } from '../../i18n'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { METHOD_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { getAuditSnapshot, refreshAudit, subscribeAudit } from '../../services/audit.service'
import { computeDebts, paymentPreset, pendingPayments, totalDebt } from '../../utils/debts'
import type { DebtRow } from '../../utils/debts'
import { daysAgo } from '../../utils/reminders'
import { Button } from '../ui/Button'
import { Hint } from '../ui/Hint'
import { ReminderDialog } from './ReminderDialog'

function lastReminderLabel(iso: string | undefined): string | null {
  if (!iso) return null
  const days = daysAgo(iso)
  return days === 0 ? tr('Oxirgi eslatma: bugun') : tr('Oxirgi eslatma: {0} kun oldin', { 0: days })
}

// Qarzdorlar (o'qish boshidan hisoblangan balans — utils/debts.ts) va "Kutilmoqda" statusidagi to'lovlar.
// Har qatorda "Eslatma" (tayyor matn), bir nechtasini belgilab — bitta nusxa
export function DebtsCard() {
  const { customers, courses, transactions, money, formatDate, openModal, updateTransaction, getCustomerName, debtContext } = useDashboard()
  const can = useCan()
  const debts = computeDebts(customers, courses, transactions, undefined, debtContext)
  const pending = pendingPayments(transactions)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [reminder, setReminder] = useState<DebtRow[] | null>(null)
  const audit = useSyncExternalStore(subscribeAudit, getAuditSnapshot, getAuditSnapshot)
  const canRemind = can('payments.create') || can('customers.edit')

  // Bulutda jurnal serverdan o'qiladi
  useEffect(() => {
    void refreshAudit()
  }, [])

  const lastReminder = new Map<string, string>()
  for (const entry of audit) {
    if (entry.action === 'reminder.sent' && entry.entityId && !lastReminder.has(entry.entityId)) lastReminder.set(entry.entityId, entry.at)
  }
  const chosen = debts.filter((d) => selected.has(d.customer.id))
  const allSelected = debts.length > 0 && chosen.length === debts.length
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section className="card" aria-labelledby="debts-title">
      <div className="card-head">
        <div>
          <div className="title-row">
            <h2 id="debts-title">{tr('Qarzdorliklar va kutilayotgan to\'lovlar')}</h2>
            <Hint term="debt" />
          </div>
          <span className="muted">
            {tr('{0} ta qarzdor, jami', { 0: debts.length })} <strong className="text-danger">{money(totalDebt(debts))}</strong>
          </span>
        </div>
        {canRemind && chosen.length > 0 && (
          <Button icon="mail" onClick={() => setReminder(chosen)}>
            {tr('Tanlanganlarga eslatma ({0})', { 0: chosen.length })}
          </Button>
        )}
      </div>

      {debts.length === 0 ? (
        <p className="muted">{tr('Qarzdorlik yo\'q — barcha o\'quvchilar muddatida to\'lagan.')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table" aria-label={tr('Qarzdorlar')}>
            <thead>
              <tr>
                {canRemind && (
                  <th scope="col" className="cell-check">
                    <input
                      type="checkbox"
                      aria-label={tr('Hammasini belgilash')}
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(debts.map((d) => d.customer.id)))}
                    />
                  </th>
                )}
                <th scope="col">{tr('Mijoz')}</th>
                <th scope="col">{tr('Guruh')}</th>
                <th scope="col" className="align-right col-optional">
                  {tr('Oylik')}
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
              {debts.map((row) => {
                const last = lastReminderLabel(lastReminder.get(row.customer.id))
                return (
                  <tr key={row.customer.id}>
                    {canRemind && (
                      <td className="cell-check">
                        <input type="checkbox" aria-label={tr('Belgilash: {0}', { 0: row.customer.name })} checked={selected.has(row.customer.id)} onChange={() => toggle(row.customer.id)} />
                      </td>
                    )}
                    <td data-label={tr('Mijoz')}>
                      <span>
                        <button type="button" className="link-btn" onClick={() => openModal({ type: 'customerDetail', payload: { id: row.customer.id } })}>
                          {row.customer.name}
                        </button>
                        <small className="muted cell-block">
                          {[row.pending > 0 ? `${tr('Kutilmoqda:')} ${money(row.pending)}` : '', last ?? ''].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                    </td>
                    <td data-label={tr('Guruh')}>{row.label}</td>
                    <td data-label={tr('Oylik')} className="align-right nowrap col-optional">
                      {money(row.monthly)}
                    </td>
                    <td data-label={tr('Qarz')} className="align-right nowrap strong text-danger">
                      {money(row.debt)}
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        {canRemind && (
                          <Button size="sm" variant="ghost" icon="mail" aria-label={tr('{0}: eslatma', { 0: row.customer.name })} onClick={() => setReminder([row])}>
                            <span className="hide-mobile">{tr('Eslatma')}</span>
                          </Button>
                        )}
                        {can('payments.create') && (
                          <Button
                            size="sm"
                            icon="plus"
                            aria-label={tr('{0}: to\'lov qabul qilish', { 0: row.customer.name })}
                            onClick={() => openModal({ type: 'transaction', payload: { kind: 'income', customerId: row.customer.id, ...paymentPreset(row) } })}
                          >
                            <span className="hide-mobile">{tr('To\'lov qabul qilish')}</span>
                            <span className="show-mobile">{tr('To\'lov')}</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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
      {reminder && (
        <ReminderDialog
          rows={reminder}
          onClose={() => {
            setReminder(null)
            setSelected(new Set())
          }}
        />
      )}
    </section>
  )
}
