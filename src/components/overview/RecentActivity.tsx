import { tr } from '../../i18n'
import { Icon, STATUS_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { recentActivity } from '../../utils/analytics'
import { cx } from '../../utils/cx'
import { Badge } from '../ui/Badge'

export function RecentActivity() {
  const { customers, transactions, money, getCustomerName, openModal, formatDate, setActiveSection } = useDashboard()
  const can = useCan()
  const items = recentActivity(customers, transactions, 5)

  return (
    <section className="card" aria-labelledby="activity-title">
      <div className="card-head">
        <h2 id="activity-title">{tr('So\'nggi amallar')}</h2>
      </div>
      {items.length === 0 ? (
        <p className="muted">{tr('Hali faoliyat yo\'q.')}</p>
      ) : (
        <ul className="activity-list">
          {items.map((item) =>
            item.kind === 'customer' ? (
              <li key={`c-${item.id}`}>
                <button
                  type="button"
                  className="activity-item"
                  onClick={() => openModal({ type: 'customerDetail', payload: { id: item.id } })}
                >
                  <span className="activity-icon tone-primary">
                    <Icon name="userPlus" size={16} />
                  </span>
                  <span className="activity-text">
                    <strong>{tr('Yangi lid:')} {item.customer.name}</strong>
                    <small className="muted">
                      {item.customer.course} · {formatDate(item.date)}
                    </small>
                  </span>
                  <Badge tone={item.customer.status}>{STATUS_LABELS[item.customer.status]}</Badge>
                </button>
              </li>
            ) : (
              <li key={`t-${item.id}`}>
                <button
                  type="button"
                  className="activity-item"
                  onClick={() => (can('payments.manage') ? openModal({ type: 'transaction', payload: { id: item.id } }) : setActiveSection('finance'))}
                >
                  <span className={cx('activity-icon', item.transaction.type === 'income' ? 'tone-success' : 'tone-danger')}>
                    <Icon name={item.transaction.type === 'income' ? 'card' : 'receipt'} size={16} />
                  </span>
                  <span className="activity-text">
                    <strong>
                      {TYPE_LABELS[item.transaction.type]}: {item.transaction.note || '—'}
                    </strong>
                    <small className="muted">
                      {item.transaction.customerId ? `${getCustomerName(item.transaction.customerId)} · ` : ''}
                      {formatDate(item.date)}
                    </small>
                  </span>
                  {item.transaction.status !== 'paid' && (
                    <Badge tone={item.transaction.status === 'pending' ? 'warning' : 'neutral'}>{TX_STATUS_LABELS[item.transaction.status]}</Badge>
                  )}
                  <span
                    className={cx(
                      'activity-amount',
                      item.transaction.status !== 'paid' ? 'muted' : item.transaction.type === 'income' ? 'text-success' : 'text-danger',
                    )}
                  >
                    {item.transaction.type === 'income' ? '+' : '−'}
                    {money(item.transaction.amount)}
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}
