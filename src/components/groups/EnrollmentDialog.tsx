import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import type { Enrollment } from '../../types/group.types'
import { formatAmountInput, parseAmount } from '../../utils/format'
import { addDays, enrollmentMonthlyFee, scheduleLabel, seatsTaken } from '../../utils/groups'
import { Button } from '../ui/Button'
import { DateInput } from '../ui/DateInput'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

export type EnrollmentAction = 'transfer' | 'pause' | 'finish' | 'price'

const TITLES: Record<EnrollmentAction, string> = {
  transfer: tr('Boshqa guruhga ko\'chirish'),
  pause: tr('Pauza'),
  finish: tr('O\'qishni tugatish'),
  price: tr('Chegirma yoki individual narx'),
}

// O'qish ustidagi amallar: ko'chirish, pauza (sanalari bilan), tugatish (yoki ketish), chegirma / individual narx
export function EnrollmentDialog({ enrollment, action, onClose }: { enrollment: Enrollment; action: EnrollmentAction; onClose: () => void }) {
  const { groups, courses, enrollments, getCustomerName, getGroup, transferEnrollment, updateEnrollment, settings, money } = useDashboard()
  const today = useToday()
  const group = getGroup(enrollment.groupId)
  const course = courses.find((c) => c.id === group?.courseId)
  const [target, setTarget] = useState('')
  const [date, setDate] = useState(today)
  const [pausedFrom, setPausedFrom] = useState(enrollment.pausedFrom ?? today)
  const [pausedTo, setPausedTo] = useState(enrollment.pausedTo ?? addDays(today, 30))
  const [reason, setReason] = useState<'finished' | 'left'>('finished')
  const [price, setPrice] = useState(enrollment.priceOverride !== undefined ? formatAmountInput(String(enrollment.priceOverride)) : '')
  const [discount, setDiscount] = useState(enrollment.discountPercent !== undefined ? String(enrollment.discountPercent) : '')
  const [error, setError] = useState('')
  const name = getCustomerName(enrollment.customerId)

  const targets = groups.filter((g) => g.id !== enrollment.groupId && g.status === 'active')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (action === 'transfer') {
      const to = groups.find((g) => g.id === target)
      if (!to) return setError(tr('Guruhni tanlang'))
      if (date < enrollment.startDate) return setError(tr('Sana o\'qish boshlanganidan oldin bo\'lmasin'))
      transferEnrollment(enrollment.id, to.id, date)
    } else if (action === 'pause') {
      if (!pausedFrom || !pausedTo || pausedTo < pausedFrom) return setError(tr('Pauza oralig\'ini to\'g\'ri kiriting'))
      updateEnrollment(enrollment.id, { status: 'paused', pausedFrom, pausedTo }, tr('pauza {0} — {1}', { 0: pausedFrom, 1: pausedTo }))
    } else if (action === 'finish') {
      if (!date || date < enrollment.startDate) return setError(tr('Sana o\'qish boshlanganidan oldin bo\'lmasin'))
      updateEnrollment(enrollment.id, { status: reason, endDate: date }, reason === 'finished' ? tr('tugatdi {0}', { 0: date }) : tr('ketdi {0}', { 0: date }))
    } else {
      const override = price.trim() === '' ? undefined : parseAmount(price)
      const percent = discount.trim() === '' ? undefined : Number(discount)
      if (override !== undefined && (!Number.isFinite(override) || override < 0)) return setError(tr('Narx 0 yoki musbat son bo\'lishi kerak'))
      if (percent !== undefined && (!Number.isFinite(percent) || percent < 0 || percent > 100)) return setError(tr('Chegirma 0 dan 100 gacha'))
      updateEnrollment(enrollment.id, { priceOverride: override, discountPercent: percent }, tr('oylik {0}', { 0: money(enrollmentMonthlyFee({ priceOverride: override, discountPercent: percent }, course)) }))
    }
    onClose()
  }

  const preview = enrollmentMonthlyFee(
    { priceOverride: price.trim() === '' ? undefined : parseAmount(price), discountPercent: discount.trim() === '' ? undefined : Number(discount) || 0 },
    course,
  )

  return (
    <Modal
      title={TITLES[action]}
      description={`${name} · ${group?.name ?? ''}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tr('Bekor qilish')}
          </Button>
          <Button type="submit" form="enrollment-form" icon="check">
            {tr('Saqlash')}
          </Button>
        </>
      }
    >
      <form id="enrollment-form" className="form" onSubmit={submit} noValidate>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {action === 'transfer' && (
          <>
            <Select
              label={tr('Yangi guruh')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              options={[
                { value: '', label: tr('Tanlang') },
                ...targets.map((g) => ({ value: g.id, label: `${g.name} · ${scheduleLabel(g)} · ${seatsTaken(g.id, enrollments, today)}/${g.capacity}` })),
              ]}
            />
            <DateInput label={tr('Ko\'chirish sanasi')} value={date} onChange={setDate} format={settings.dateFormat} hint={tr('Eski guruhda bir kun oldin tugaydi; narx va chegirma saqlanadi')} />
          </>
        )}
        {action === 'pause' && (
          <div className="form-row">
            <DateInput label={tr('Pauza boshlanishi')} value={pausedFrom} onChange={setPausedFrom} format={settings.dateFormat} />
            <DateInput label={tr('Pauza tugashi')} value={pausedTo} onChange={setPausedTo} format={settings.dateFormat} hint={tr('Pauza oylari to\'lov hisoblanmaydi')} />
          </div>
        )}
        {action === 'finish' && (
          <>
            <Select
              label={tr('Sabab')}
              value={reason}
              onChange={(e) => setReason(e.target.value as 'finished' | 'left')}
              options={[
                { value: 'finished', label: tr('Kursni tugatdi') },
                { value: 'left', label: tr('Ketdi (o\'qishni to\'xtatdi)') },
              ]}
            />
            <DateInput label={tr('Oxirgi kun')} value={date} onChange={setDate} format={settings.dateFormat} hint={tr('Shu kundan keyingi oylar to\'lov hisoblanmaydi')} />
          </>
        )}
        {action === 'price' && (
          <>
            <div className="form-row">
              <Input label={tr('Individual oylik narx')} inputMode="numeric" value={price} placeholder={course ? formatAmountInput(String(course.monthlyPrice)) : ''} onChange={(e) => setPrice(formatAmountInput(e.target.value))} hint={tr('Bo\'sh — kurs narxi')} />
              <Input label={tr('Chegirma, %')} inputMode="decimal" value={discount} placeholder="0" onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} />
            </div>
            <p className="notice notice-info">{tr('Oylik summa: {0}', { 0: money(preview) })}</p>
          </>
        )}
      </form>
    </Modal>
  )
}
