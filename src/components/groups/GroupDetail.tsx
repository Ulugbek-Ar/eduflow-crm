import { useState } from 'react'
import { STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import type { GroupTab } from '../../types/dashboard.types'
import type { Enrollment } from '../../types/group.types'
import { attendanceRate, rateLabel, recordsFor } from '../../utils/attendance'
import { incomesByEnrollment } from '../../utils/attribution'
import { cx } from '../../utils/cx'
import { addDays, ENROLLMENT_STATUS_LABELS, enrollmentMonthlyFee, GROUP_STATUS_LABELS, occupiesSeat, scheduleLabel, seatsTaken } from '../../utils/groups'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { Combobox } from '../ui/Combobox'
import { DateInput } from '../ui/DateInput'
import { Modal } from '../ui/Modal'
import { Capacity } from './Capacity'
import { EnrollmentDialog } from './EnrollmentDialog'
import { AttendanceGrid } from '../attendance/AttendanceGrid'
import type { EnrollmentAction } from './EnrollmentDialog'
import './groups.css'

// Guruh kartasi: ma'lumotlar, o'quvchilar (qo'shish, ko'chirish, pauza, tugatish, narx), shu oy to'lovlari
export function GroupDetail({ groupId, tab: initialTab = 'students' }: { groupId: string; tab?: GroupTab }) {
  const {
    getGroup,
    courses,
    teachers,
    customers,
    enrollments,
    transactions,
    attendance,
    groups,
    money,
    formatDate,
    closeModal,
    openModal,
    enroll,
    removeEnrollment,
    updateEnrollment,
    removeGroup,
    updateGroup,
    getCustomerName,
    settings,
    getBranch,
  } = useDashboard()
  const can = useCan()
  const confirm = useConfirm()
  const today = useToday()
  const [tab, setTab] = useState<GroupTab>(initialTab)
  const [candidate, setCandidate] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [dialog, setDialog] = useState<{ enrollment: Enrollment; action: EnrollmentAction } | null>(null)
  const group = getGroup(groupId)

  if (!group) {
    return (
      <Modal title={tr('Guruh topilmadi')} onClose={closeModal} variant="drawer">
        <p className="muted">{tr('Bu guruh o\'chirilgan bo\'lishi mumkin.')}</p>
      </Modal>
    )
  }

  const canEdit = can('groups.edit')
  const course = courses.find((c) => c.id === group.courseId)
  const teacher = teachers.find((t) => t.id === group.teacherId)
  const members = enrollments
    .filter((e) => e.groupId === group.id)
    .sort((a, b) => Number(occupiesSeat(b, today)) - Number(occupiesSeat(a, today)) || getCustomerName(a.customerId).localeCompare(getCustomerName(b.customerId)))
  const taken = seatsTaken(group.id, enrollments, today)
  const full = taken >= group.capacity
  const seated = new Set(members.filter((e) => occupiesSeat(e, today)).map((e) => e.customerId))
  const options = customers
    .filter((c) => !seated.has(c.id) && c.status !== 'cancelled')
    .map((c) => ({ value: c.id, label: c.name, description: `${c.phone} · ${STATUS_LABELS[c.status]}${c.course ? ` · ${c.course}` : ''}` }))

  // Shu oy to'lovlari (kirim qaysi guruhga tegishli — utils/attribution.ts qoidasi)
  const monthStart = `${today.slice(0, 7)}-01`
  const byEnrollment = incomesByEnrollment(
    transactions.filter((t) => t.date.slice(0, 10) >= monthStart),
    { enrollments, groups, courses, customers },
  )
  const monthPayments = members.flatMap((e) => (byEnrollment.get(e.id) ?? []).map((t) => ({ t, e }))).sort((a, b) => b.t.date.localeCompare(a.t.date))
  const monthTotal = monthPayments.reduce((sum, p) => sum + p.t.amount, 0)

  const addStudent = async () => {
    const customer = customers.find((c) => c.id === candidate)
    if (!customer) return
    if (full) {
      const ok = await confirm({
        title: tr('Guruh to\'lgan'),
        message: tr('"{0}" da {1} / {2} o\'rin band. Baribir qo\'shasizmi?', { 0: group.name, 1: taken, 2: group.capacity }),
        confirmLabel: tr('Baribir qo\'shish'),
        tone: 'primary',
      })
      if (!ok) return
    }
    if (customer.status !== 'paid') {
      const ok = await confirm({
        title: tr('Lidni guruhga qo\'shish'),
        message: tr('{0} hozir "{1}" bosqichida. Guruhga qo\'shilsa, bosqichi "To\'lov qildi"ga o\'tadi.', { 0: customer.name, 1: STATUS_LABELS[customer.status] }),
        confirmLabel: tr('Qo\'shish'),
        tone: 'primary',
      })
      if (!ok) return
    }
    if (enroll({ customerId: customer.id, groupId: group.id, startDate })) setCandidate('')
  }

  const remove = async (e: Enrollment) => {
    const ok = await confirm({
      title: tr('Guruhdan o\'chirish'),
      message: tr('{0} ning "{1}" dagi yozuvi savatchaga o\'tadi (30 kun ichida tiklash mumkin). O\'qishni to\'xtatgan bo\'lsa, "Tugatish"dan foydalaning — tarix saqlanadi.', { 0: getCustomerName(e.customerId), 1: group.name }),
      confirmLabel: tr('O\'chirish'),
    })
    if (ok) removeEnrollment(e.id)
  }

  const archive = async () => {
    const ok = await confirm({
      title: group.status === 'archived' ? tr('Arxivdan qaytarish') : tr('Guruhni arxivlash'),
      message:
        group.status === 'archived'
          ? tr('"{0}" yana faol bo\'ladi va jadvalda ko\'rinadi.', { 0: group.name })
          : tr('"{0}" jadvaldan va ro\'yxatdan yashiriladi, o\'quvchilar tarixi saqlanadi. Keyin qaytarish mumkin.', { 0: group.name }),
      confirmLabel: group.status === 'archived' ? tr('Qaytarish') : tr('Arxivlash'),
      tone: 'primary',
    })
    if (!ok) return
    if (group.status === 'archived') updateGroup(group.id, { status: 'active' })
    else if (members.length === 0) {
      removeGroup(group.id)
      closeModal()
    } else updateGroup(group.id, { status: 'archived' })
  }

  const tabs: Array<{ id: GroupTab; label: string }> = [
    { id: 'students', label: tr('O\'quvchilar ({0})', { 0: taken }) },
    ...(can('attendance.view') ? [{ id: 'attendance' as const, label: tr('Davomat') }] : []),
    ...(can('payments.view') ? [{ id: 'payments' as const, label: tr('Shu oy to\'lovlari') }] : []),
  ]

  return (
    <Modal
      title={group.name}
      description={`${course?.name ?? '—'} · ${teacher?.name ?? tr('O\'qituvchi biriktirilmagan')}`}
      onClose={closeModal}
      variant="drawer"
      size="lg"
      footer={
        canEdit ? (
          <>
            <Button variant="ghost" icon="archive" onClick={archive}>
              {group.status === 'archived' ? tr('Qaytarish') : members.length === 0 ? tr('O\'chirish') : tr('Arxivlash')}
            </Button>
            <Button variant="ghost" icon="edit" onClick={() => openModal({ type: 'group', payload: { id: group.id } })}>
              {tr('Tahrirlash')}
            </Button>
          </>
        ) : undefined
      }
    >
      {/* Ochilganda fokus ma'lumotlarga (qidiruv maydoni o'zi ochilib ketmasin) */}
      <dl className="group-info" tabIndex={-1} data-autofocus>
        <div>
          <dt>{tr('Kunlar va vaqt')}</dt>
          <dd>{scheduleLabel(group)}</dd>
        </div>
        <div>
          <dt>{tr('Xona')}</dt>
          <dd>{group.room || '—'}</dd>
        </div>
        {group.branchId && getBranch(group.branchId) && (
          <div>
            <dt>{tr('Filial')}</dt>
            <dd>{getBranch(group.branchId)?.name}</dd>
          </div>
        )}
        <div>
          <dt>{tr('Sig\'im')}</dt>
          <dd>
            <Capacity taken={taken} capacity={group.capacity} />
          </dd>
        </div>
        <div>
          <dt>{tr('Holat')}</dt>
          <dd>
            <Badge tone={group.status === 'active' ? 'paid' : 'neutral'}>{GROUP_STATUS_LABELS[group.status]}</Badge>
          </dd>
        </div>
        <div>
          <dt>{tr('Boshlangan')}</dt>
          <dd>{formatDate(`${group.startDate}T12:00:00`)}</dd>
        </div>
        <div>
          <dt>{tr('Oylik narx')}</dt>
          <dd>{course ? money(course.monthlyPrice) : '—'}</dd>
        </div>
        <div>
          <dt>{tr('Davomat (30 kun)')}</dt>
          <dd>{rateLabel(attendanceRate(recordsFor(attendance, { groupId: group.id, from: addDays(today, -30), to: today })))}</dd>
        </div>
      </dl>

      {full && (
        <p className="notice notice-warning" role="status">
          {tr('Guruh to\'lgan: {0} / {1}. Yangi o\'quvchi uchun boshqa guruh oching yoki sig\'imni oshiring.', { 0: taken, 1: group.capacity })}
        </p>
      )}

      {tabs.length > 1 && (
        <div className="segmented detail-tabs" role="tablist" aria-label={tr('Guruh bo\'limlari')}>
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx(tab === t.id && 'is-active')} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'students' && (
        <div role="tabpanel">
          {canEdit && group.status === 'active' && (
            <div className="add-student">
              <Combobox
                label={tr('O\'quvchi qo\'shish')}
                options={options}
                value={candidate}
                onChange={setCandidate}
                placeholder={tr('Ism yoki telefon')}
                emptyText={tr('Mijoz topilmadi')}
              />
              <DateInput label={tr('Boshlanish sanasi')} value={startDate} onChange={setStartDate} format={settings.dateFormat} />
              <Button icon="plus" disabled={!candidate} onClick={addStudent}>
                {tr('Qo\'shish')}
              </Button>
            </div>
          )}
          {members.length === 0 ? (
            <p className="muted">{tr('Guruhda hali o\'quvchi yo\'q.')}</p>
          ) : (
            <ul className="enrollment-list">
              {members.map((e) => {
                const rate = attendanceRate(recordsFor(attendance, { customerId: e.customerId, groupId: group.id }))
                const fee = enrollmentMonthlyFee(e, course)
                const inactive = !occupiesSeat(e, today)
                return (
                  <li key={e.id} className={cx('enrollment-row', inactive && 'is-muted')}>
                    <div>
                      {can('customers.view') && customers.some((c) => c.id === e.customerId && c.phone) ? (
                        <button type="button" className="link-btn" onClick={() => openModal({ type: 'customerDetail', payload: { id: e.customerId } })}>
                          {getCustomerName(e.customerId)}
                        </button>
                      ) : (
                        <strong>{getCustomerName(e.customerId)}</strong>
                      )}
                      <div className="meta">
                        <span>
                          <Badge tone={e.status === 'active' ? 'paid' : e.status === 'paused' ? 'thinking' : 'neutral'}>{ENROLLMENT_STATUS_LABELS[e.status]}</Badge>
                        </span>
                        <span>{tr('{0} dan', { 0: formatDate(`${e.startDate}T12:00:00`) })}</span>
                        {e.endDate && e.status !== 'active' && <span>{tr('{0} gacha', { 0: formatDate(`${e.endDate}T12:00:00`) })}</span>}
                        {e.status === 'paused' && e.pausedFrom && (
                          <span>{tr('pauza: {0} — {1}', { 0: formatDate(`${e.pausedFrom}T12:00:00`), 1: e.pausedTo ? formatDate(`${e.pausedTo}T12:00:00`) : '…' })}</span>
                        )}
                        {can('payments.view') && (
                          <span>
                            {money(fee)}
                            {tr('/oy')}
                            {e.discountPercent ? ` (−${e.discountPercent}%)` : ''}
                            {e.priceOverride !== undefined ? ` · ${tr('individual')}` : ''}
                          </span>
                        )}
                        <span>{tr('Davomat: {0}', { 0: rateLabel(rate) })}</span>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="enrollment-actions">
                        {e.status === 'active' && (
                          <>
                            <IconButton icon="move" label={tr('Ko\'chirish: {0}', { 0: getCustomerName(e.customerId) })} onClick={() => setDialog({ enrollment: e, action: 'transfer' })} />
                            <IconButton icon="clock" label={tr('Pauza: {0}', { 0: getCustomerName(e.customerId) })} onClick={() => setDialog({ enrollment: e, action: 'pause' })} />
                            <IconButton icon="checkCircle" label={tr('Tugatish: {0}', { 0: getCustomerName(e.customerId) })} onClick={() => setDialog({ enrollment: e, action: 'finish' })} />
                          </>
                        )}
                        {e.status === 'paused' && (
                          <IconButton
                            icon="play"
                            label={tr('Pauzadan qaytarish: {0}', { 0: getCustomerName(e.customerId) })}
                            onClick={() => updateEnrollment(e.id, { status: 'active', pausedTo: e.pausedTo && e.pausedTo > today ? today : e.pausedTo }, tr('pauzadan qaytdi'))}
                          />
                        )}
                        {can('payments.view') && <IconButton icon="percent" label={tr('Chegirma / narx: {0}', { 0: getCustomerName(e.customerId) })} onClick={() => setDialog({ enrollment: e, action: 'price' })} />}
                        <IconButton icon="trash" tone="danger" label={tr('Guruhdan o\'chirish: {0}', { 0: getCustomerName(e.customerId) })} onClick={() => remove(e)} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div role="tabpanel">
          <AttendanceGrid groupId={group.id} />
        </div>
      )}

      {tab === 'payments' && (
        <div role="tabpanel">
          <div className="detail-total">
            <span>{tr('Shu oy guruh o\'quvchilaridan')}</span>
            <strong className="text-success">{money(monthTotal)}</strong>
          </div>
          {monthPayments.length === 0 ? (
            <p className="muted">{tr('Bu oy hali to\'lov yo\'q.')}</p>
          ) : (
            <ul className="payment-list">
              {monthPayments.map(({ t, e }) => (
                <li key={t.id}>
                  <div>
                    <strong>{getCustomerName(e.customerId)}</strong>
                    <small className="muted">
                      {formatDate(t.date)} · {t.note}
                    </small>
                  </div>
                  <span className="text-success">+{money(t.amount)}</span>
                  <IconButton icon="receipt" label={tr('Chek: {0}', { 0: getCustomerName(e.customerId) })} onClick={() => openModal({ type: 'receipt', payload: { id: t.id } })} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {dialog && <EnrollmentDialog enrollment={dialog.enrollment} action={dialog.action} onClose={() => setDialog(null)} />}
    </Modal>
  )
}
