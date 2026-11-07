import { tr } from '../../i18n'
import { useState } from 'react'
import { FUNNEL_STAGES, METHOD_LABELS, SOURCE_LABELS, STATUS_LABELS, TX_STATUS_LABELS } from '../../constants/navigation'
import type { CustomerStatus } from '../../types/customer.types'
import { useDashboard } from '../../context/useDashboard'
import { useAuditActor, useCan } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { deleteCustomerMessage, getInitials } from '../../utils/customers'
import { attendanceRate, rateLabel, recordsFor } from '../../utils/attendance'
import { customerEnrollments, ENROLLMENT_STATUS_LABELS, enrollmentMonthlyFee } from '../../utils/groups'
import { Badge } from '../ui/Badge'
import { customerDebt, studyMonthNumber } from '../../utils/debts'
import { CustomerCard } from '../print/CustomerCard'
import { PrintDocument } from '../print/PrintDocument'
import { Button, IconButton } from '../ui/Button'
import { Modal } from '../ui/Modal'

export function CustomerDetail({ customerId }: { customerId: string }) {
  const { getCustomer, transactions, courses, groups, enrollments, attendance, money, openModal, closeModal, deleteCustomer, updateCustomer, formatDate, settings } = useDashboard()
  const confirm = useConfirm()
  const can = useCan()
  const actor = useAuditActor()
  // Chop etish vaqti (bosilgan paytda) — kartada ko'rsatiladi
  const [printedAt, setPrintedAt] = useState<string | null>(null)
  const customer = getCustomer(customerId)

  if (!customer) {
    return (
      <Modal title={tr('Mijoz topilmadi')} onClose={closeModal} variant="drawer">
        <p className="muted">{tr('Bu mijoz o\'chirilgan bo\'lishi mumkin.')}</p>
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
  const studentEnrollments = customerEnrollments(customer.id, enrollments)
  const studyMonth = customer.status === 'paid' ? studyMonthNumber(customer) : null
  const finished = course && course.durationMonths > 0 && studyMonth !== null && studyMonth > course.durationMonths

  const handleDelete = async () => {
    const ok = await confirm({
      title: tr('Mijozni o\'chirish'),
      message: deleteCustomerMessage(customer, transactions, money),
      confirmLabel: tr('O\'chirish'),
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
              {tr('O\'chirish')}
            </Button>
          )}
          <Button variant="ghost" icon="fileText" onClick={() => setPrintedAt(new Date().toISOString())}>
            {tr('Chop etish')}
          </Button>
          {can('customers.edit') && (
            <Button variant="ghost" icon="edit" onClick={() => openModal({ type: 'customer', payload: { id: customer.id } })}>
              {tr('Tahrirlash')}
            </Button>
          )}
          {can('payments.create') && (
            <Button
              icon="plus"
              onClick={() => openModal({ type: 'transaction', payload: { kind: 'income', customerId: customer.id, amount: debt?.debt || undefined } })}
            >
              {tr('To\'lov')}
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
            <span className="sr-only">{tr('Bosqich')}</span>
            <select
            className={`status-select badge-${customer.status}`}
            value={customer.status}
            aria-label={tr('Bosqichni o\'zgartirish')}
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
          <p className="muted">{SOURCE_LABELS[customer.source]} {tr('orqali kelgan')}</p>
        </div>
      </div>

      <dl className="detail-list">
        <div>
          <dt>{tr('Telefon')}</dt>
          <dd>
            <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
          </dd>
        </div>
        <div>
          <dt>{tr('Email')}</dt>
          <dd>{customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : '—'}</dd>
        </div>
        <div>
          <dt>{tr('Qo\'shilgan')}</dt>
          <dd>{formatDate(customer.createdAt)}</dd>
        </div>
        <div>
          <dt>{tr('Yangilangan')}</dt>
          <dd>{customer.updatedAt ? formatDate(customer.updatedAt) : '—'}</dd>
        </div>
        {customer.paidAt && (
          <div>
            <dt>{tr('To\'lov qildi')}</dt>
            <dd>{formatDate(customer.paidAt)}</dd>
          </div>
        )}
        {course && studyMonth !== null && (
          <div>
            <dt>{tr('O\'qish')}</dt>
            <dd>
              {finished
                ? tr('Tugagan ({0} oy)', { 0: course.durationMonths })
                : course.durationMonths > 0
                  ? tr('{0}-oy / {1}', { 0: studyMonth, 1: course.durationMonths })
                  : tr('{0}-oy (muddatsiz)', { 0: studyMonth })}
            </dd>
          </div>
        )}
        {customer.note && (
          <div className="detail-wide">
            <dt>{tr('Izoh')}</dt>
            <dd>{customer.note}</dd>
          </div>
        )}
      </dl>

      {studentEnrollments.length > 0 && (
        <>
          <h3 className="detail-subtitle">{tr('Guruhlari')}</h3>
          <ul className="student-groups">
            {studentEnrollments.map((e) => {
              const group = groups.find((g) => g.id === e.groupId)
              const groupCourse = courses.find((c) => c.id === group?.courseId)
              const rate = attendanceRate(recordsFor(attendance, { customerId: customer.id, groupId: e.groupId }))
              return (
                <li key={e.id}>
                  <div>
                    {group && can('groups.view') ? (
                      <button type="button" className="link-btn" onClick={() => openModal({ type: 'groupDetail', payload: { id: group.id } })}>
                        {group.name}
                      </button>
                    ) : (
                      <strong>{group?.name ?? tr('O\'chirilgan guruh')}</strong>
                    )}
                    <small className="muted cell-block">
                      {tr('{0} dan', { 0: formatDate(`${e.startDate}T12:00:00`) })}
                      {e.endDate && e.status !== 'active' ? ` · ${tr('{0} gacha', { 0: formatDate(`${e.endDate}T12:00:00`) })}` : ''}
                      {' · '}
                      {money(enrollmentMonthlyFee(e, groupCourse))}
                      {tr('/oy')}
                    </small>
                  </div>
                  <span className="student-group-stats">
                    <Badge tone={e.status === 'active' ? 'paid' : e.status === 'paused' ? 'thinking' : 'neutral'}>{ENROLLMENT_STATUS_LABELS[e.status]}</Badge>
                    <span className="muted">{tr('Davomat: {0}', { 0: rateLabel(rate) })}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="detail-total">
        <span>{tr('Jami to\'lagan')}</span>
        <strong className="text-success">{money(totalPaid)}</strong>
      </div>

      {debt && (
        <div className={debt.debt > 0 ? 'detail-total is-debt' : 'detail-total'}>
          <span>
            {tr('Joriy oy: kutilgan')} {money(debt.expected)}{tr(', to\'langan')} {money(debt.paid)}
          </span>
          <strong className={debt.debt > 0 ? 'text-danger nowrap' : 'text-success nowrap'}>{debt.debt > 0 ? tr('Qarz: {0}', { 0: money(debt.debt) }) : tr('Qarz yo\'q')}</strong>
        </div>
      )}

      <h3 className="detail-subtitle">{tr('To\'lovlar tarixi')}</h3>
      {payments.length === 0 ? (
        <p className="muted">{tr('Hali to\'lov qayd etilmagan.')}</p>
      ) : (
        <ul className="payment-list">
          {payments.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.note || tr('To\'lov')}</strong>
                <small className="muted">
                  {formatDate(t.date)} · {METHOD_LABELS[t.method]} · {TX_STATUS_LABELS[t.status]}
                </small>
              </div>
              <span className={t.status !== 'paid' ? 'muted' : t.type === 'income' ? 'text-success' : 'text-danger'}>
                {t.type === 'income' ? '+' : '−'}
                {money(t.amount)}
              </span>
              {t.type === 'income' && (
                <IconButton icon="receipt" label={tr('Chek: {0}, {1}', { 0: formatDate(t.date), 1: money(t.amount) })} onClick={() => openModal({ type: 'receipt', payload: { id: t.id } })} />
              )}
            </li>
          ))}
        </ul>
      )}
      {printedAt && (
        <PrintDocument size="a4" onDone={() => setPrintedAt(null)}>
          <CustomerCard
            customer={customer}
            payments={payments}
            debt={debt}
            totalPaid={totalPaid}
            settings={settings}
            money={money}
            printedBy={actor?.userName ?? ''}
            printedAt={printedAt}
          />
        </PrintDocument>
      )}
    </Modal>
  )
}
