import { FUNNEL_STAGES, METHOD_LABELS, SOURCE_LABELS, STATUS_LABELS, TX_STATUS_LABELS } from '../../constants/navigation'
import type { CustomerStatus } from '../../types/customer.types'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { deleteCustomerMessage, getInitials } from '../../utils/customers'
import { customerDebt, studyMonthNumber } from '../../utils/debts'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export function CustomerDetail({ customerId }: { customerId: string }) {
  const { getCustomer, transactions, courses, money, openModal, closeModal, deleteCustomer, updateCustomer, formatDate } = useDashboard()
  const confirm = useConfirm()
  const can = useCan()
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
  // Faqat "To'langan" kirimlar
  const totalPaid = payments.reduce((sum, t) => sum + (t.type === 'income' && t.status === 'paid' ? t.amount : 0), 0)
  const debt = customerDebt(customer, courses, transactions)
  const course = courses.find((c) => c.name === customer.course)
  const studyMonth = customer.status === 'paid' ? studyMonthNumber(customer) : null
  const finished = course && course.durationMonths > 0 && studyMonth !== null && studyMonth > course.durationMonths

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Mijozni o\'chirish',
      message: deleteCustomerMessage(customer, transactions, money),
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
          {can('customers.delete') && (
            <Button variant="danger" icon="trash" onClick={handleDelete}>
              O'chirish
            </Button>
          )}
          {can('customers.edit') && (
            <Button variant="ghost" icon="edit" onClick={() => openModal({ type: 'customer', payload: { id: customer.id } })}>
              Tahrirlash
            </Button>
          )}
          {can('payments.create') && (
            <Button
              icon="plus"
              onClick={() => openModal({ type: 'transaction', payload: { kind: 'income', customerId: customer.id, amount: debt?.debt || undefined } })}
            >
              To'lov
            </Button>
          )}
        </>
      }
    >
      <div className="profile-head">
        <span className="avatar avatar-lg">{getInitials(customer.name)}</span>
        <div>
          {/* Bosqich rangli tanlov ko'rinishida — badge vazifasini ham bajaradi */}
          <label className="stage-quick">
            <span className="sr-only">Bosqich</span>
            <select
            className={`status-select badge-${customer.status}`}
            value={customer.status}
            aria-label="Bosqichni o'zgartirish"
            disabled={!can('customers.edit')}
            onChange={(e) => updateCustomer(customer.id, { status: e.target.value as CustomerStatus })}
          >
            {FUNNEL_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STATUS_LABELS[stage]}
              </option>
            ))}
            </select>
          </label>
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
        {customer.paidAt && (
          <div>
            <dt>To'lov qildi</dt>
            <dd>{formatDate(customer.paidAt)}</dd>
          </div>
        )}
        {course && studyMonth !== null && (
          <div>
            <dt>O'qish</dt>
            <dd>
              {finished
                ? `Tugagan (${course.durationMonths} oy)`
                : course.durationMonths > 0
                  ? `${studyMonth}-oy / ${course.durationMonths}`
                  : `${studyMonth}-oy (muddatsiz)`}
            </dd>
          </div>
        )}
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

      {debt && (
        <div className={debt.debt > 0 ? 'detail-total is-debt' : 'detail-total'}>
          <span>
            Joriy oy: kutilgan {money(debt.expected)}, to'langan {money(debt.paid)}
          </span>
          <strong className={debt.debt > 0 ? 'text-danger nowrap' : 'text-success nowrap'}>{debt.debt > 0 ? `Qarz: ${money(debt.debt)}` : 'Qarz yo\'q'}</strong>
        </div>
      )}

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
                  {formatDate(t.date)} · {METHOD_LABELS[t.method]} · {TX_STATUS_LABELS[t.status]}
                </small>
              </div>
              <span className={t.status !== 'paid' ? 'muted' : t.type === 'income' ? 'text-success' : 'text-danger'}>
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
