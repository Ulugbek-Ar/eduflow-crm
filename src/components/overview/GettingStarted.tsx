import { useSyncExternalStore } from 'react'
import { Icon } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { isBoolean, usePersistentState } from '../../hooks/usePersistentState'
import { getAuditSnapshot, subscribeAudit } from '../../services/audit.service'
import { cx } from '../../utils/cx'
import { scrollToId } from '../../utils/scroll'
import { Button } from '../ui/Button'

export const CHECKLIST_HIDDEN_KEY = 'apex:checklist-hidden'

// Yangi markaz uchun "nimadan boshlash" ro'yxati: bajarilgani belgilanadi, hammasi tayyor bo'lsa yo'qoladi
export function GettingStarted() {
  const { courses, customers, transactions, openModal, setActiveSection } = useDashboard()
  const { users, can, mode } = useAuth()
  const audit = useSyncExternalStore(subscribeAudit, getAuditSnapshot)
  const [hidden, setHidden] = usePersistentState(CHECKLIST_HIDDEN_KEY, false, isBoolean)
  if (hidden || mode === 'demo' || !can('staff.manage')) return null

  const steps = [
    { id: 'course', label: 'Kurs va narxlarni kiriting', done: courses.length > 0, action: () => openModal({ type: 'course' }) },
    { id: 'customer', label: 'Birinchi mijozni qo\'shing', done: customers.length > 0, action: () => openModal({ type: 'customer' }) },
    {
      id: 'payment',
      label: 'Birinchi to\'lovni qabul qiling',
      done: transactions.some((t) => t.type === 'income'),
      action: () => openModal({ type: 'transaction', payload: { kind: 'income' } }),
    },
    { id: 'staff', label: 'Xodimlarni qo\'shing', done: users.length > 1, action: () => setActiveSection('admin') },
    {
      id: 'backup',
      label: 'Birinchi zaxirani oling',
      done: audit.some((e) => e.action === 'data.backup'),
      action: () => {
        setActiveSection('settings')
        scrollToId('data')
      },
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  return (
    <section className="card getting-started" aria-labelledby="getting-started-title">
      <div className="card-head">
        <div>
          <h2 id="getting-started-title">Boshlash uchun {steps.length} qadam</h2>
          <span className="muted">
            {doneCount} / {steps.length} bajarildi
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHidden(true)}>
          Yashirish
        </Button>
      </div>
      <div className="progress" role="progressbar" aria-label="Boshlash qadamlari" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
        <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="checklist">
        {steps.map((step) => (
          <li key={step.id} className={cx(step.done && 'is-done')}>
            <span className="check-dot" aria-hidden="true">
              {step.done && <Icon name="check" size={14} />}
            </span>
            <span className="checklist-label">
              {step.label}
              {step.done && <span className="sr-only"> (bajarildi)</span>}
            </span>
            {!step.done && (
              <Button size="sm" variant="ghost" onClick={step.action}>
                Boshlash
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
