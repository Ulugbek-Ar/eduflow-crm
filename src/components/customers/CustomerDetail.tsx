import { METHOD_LABELS, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useConfirm } from '../../hooks/useConfirm'
import { getInitials } from '../../utils/customers'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export function CustomerDetail({ customerId }: { customerId: string }) {
  const { getCustomer, transactions, money, openModal, closeModal, deleteCustomer, formatDate } = useDashboard()
  const confirm = useConfirm()
  const customer = getCustomer(customerId)

  if (!customer) {
    return (
      <Modal title="Mijoz topilmadi" onClose={closeModal} variant="drawer">
        <p className="muted">Bu mijoz o'chirilgan bo'lishi mumkin.</p>
      </Modal>
    )
  }

  const payments = transactions
    .filter((t) => t.customerId === customer.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const totalPaid = payments.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : 0), 0)

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Mijozni o\'chirish',
      message: `"${customer.name}" mijozi butunlay o'chiriladi. Davom etasizmi?`,
      confirmLabel: 'O\'chirish',
    })
    if (ok) {
      deleteCustomer(customer.id)
      closeModal()
    }
  }

  return (
    <Modal
      title={customer.name}
      description={customer.course}
      onClose={closeModal}
      variant="drawer"
      footer={
        <>
          <Button variant="danger" icon="trash" onClick={handleDelete}>
            O'chirish
          </Button>
          <Button variant="ghost" icon="edit" onClick={() => openModal({ type: 'customer', payload: { id: customer.id } })}>
            Tahrirlash
          </Button>
          <Button
            icon="plus"
            onClick={() => openModal({ type: 'transaction', payload: { kind: 'income', customerId: customer.id } })}
          >
            To'lov
          </Button>
        </>
      }
    >
      <div className="profile-head">
        <span className="avatar avatar-lg">{getInitials(customer.name)}</span>
        <div>
          <Badge tone={customer.status}>{STATUS_LABELS[customer.status]}</Badge>
          <p className="muted">{SOURCE_LABELS[customer.source]} orqali kelgan</p>
        </div>
      </div>

      <dl className="detail-list">
        <div>
          <dt>Telefon</dt>
          <dd>
            <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : '—'}</dd>
        </div>
        <div>
          <dt>Qo'shilgan</dt>
          <dd>{formatDate(customer.createdAt)}</dd>
        </div>
        <div>
          <dt>Yangilangan</dt>
          <dd>{customer.updatedAt ? formatDate(customer.updatedAt) : '—'}</dd>
        </div>
        {customer.note && (
          <div className="detail-wide">
            <dt>Izoh</dt>
            <dd>{customer.note}</dd>
          </div>
        )}
      </dl>

      <div className="detail-total">
        <span>Jami to'lagan</span>
        <strong className="text-success">{money(totalPaid)}</strong>
      </div>

      <h3 className="detail-subtitle">To'lovlar tarixi</h3>
      {payments.length === 0 ? (
        <p className="muted">Hali to'lov qayd etilmagan.</p>
      ) : (
        <ul className="payment-list">
          {payments.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.note || 'To\'lov'}</strong>
                <small className="muted">
                  {formatDate(t.date)} · {METHOD_LABELS[t.method]}
                </small>
              </div>
              <span className={t.type === 'income' ? 'text-success' : 'text-danger'}>
                {t.type === 'income' ? '+' : '−'}
                {money(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
