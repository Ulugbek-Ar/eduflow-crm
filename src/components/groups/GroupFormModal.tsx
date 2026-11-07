import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import type { GroupInput, GroupStatus, Weekday } from '../../types/group.types'
import { validateGroup } from '../../utils/groupForm'
import type { GroupFormErrors } from '../../utils/groupForm'
import { GROUP_STATUS_LABELS, seatsTaken, sortDays, WEEKDAY_LONG, WEEKDAY_SHORT, WEEKDAYS } from '../../utils/groups'
import { Button } from '../ui/Button'
import { DateInput } from '../ui/DateInput'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import './groups.css'

const FIELD_ORDER = ['name', 'courseId', 'days', 'startTime', 'endTime', 'capacity', 'startDate', 'endDate'] as const

interface FormState {
  name: string
  courseId: string
  teacherId: string
  room: string
  days: Weekday[]
  startTime: string
  endTime: string
  capacity: string
  startDate: string
  endDate: string
  status: GroupStatus
}

export function GroupFormModal({ groupId }: { groupId?: string }) {
  const { groups, courses, teachers, enrollments, getGroup, addGroup, updateGroup, closeModal, openModal, settings } = useDashboard()
  const today = useToday()
  const editing = getGroup(groupId)
  const [form, setForm] = useState<FormState>(() => ({
    name: editing?.name ?? '',
    courseId: editing?.courseId ?? courses.find((c) => c.status === 'active' && c.type === 'course')?.id ?? '',
    teacherId: editing?.teacherId ?? '',
    room: editing?.room ?? '',
    days: editing?.days ?? ['mon', 'wed', 'fri'],
    startTime: editing?.startTime ?? '14:00',
    endTime: editing?.endTime ?? '15:30',
    capacity: String(editing?.capacity ?? 12),
    startDate: editing?.startDate ?? today,
    endDate: editing?.endDate ?? '',
    status: editing?.status ?? 'active',
  }))
  const [errors, setErrors] = useState<GroupFormErrors>({})
  const taken = editing ? seatsTaken(editing.id, enrollments, today) : 0

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined, conflict: undefined }))
  }

  const toggleDay = (day: Weekday) => update('days', form.days.includes(day) ? form.days.filter((d) => d !== day) : sortDays([...form.days, day]))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data: GroupInput = {
      name: form.name,
      courseId: form.courseId,
      teacherId: form.teacherId || undefined,
      room: form.room.trim(),
      days: form.days,
      startTime: form.startTime,
      endTime: form.endTime,
      capacity: form.capacity.trim() === '' ? Number.NaN : Number(form.capacity),
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      status: form.status,
    }
    const next = validateGroup(data, groups, editing?.id, teachers)
    setErrors(next)
    const first = FIELD_ORDER.find((key) => next[key])
    if (first) {
      document.getElementById(`group-${first}`)?.focus()
      return
    }
    if (next.conflict) {
      document.getElementById('group-conflict')?.focus()
      return
    }
    if (editing) {
      updateGroup(editing.id, data)
      openModal({ type: 'groupDetail', payload: { id: editing.id } })
    } else {
      const created = addGroup(data)
      if (created) openModal({ type: 'groupDetail', payload: { id: created.id } })
      else closeModal()
    }
  }

  const courseOptions = courses
    .filter((c) => c.status === 'active' || c.id === editing?.courseId)
    .map((c) => ({ value: c.id, label: c.name }))
  const teacherOptions = [
    { value: '', label: tr('Biriktirilmagan') },
    ...teachers.filter((t) => t.status === 'active' || t.id === editing?.teacherId).map((t) => ({ value: t.id, label: t.name })),
  ]

  return (
    <Modal
      title={editing ? tr('Guruhni tahrirlash') : tr('Yangi guruh')}
      description={editing ? editing.name : tr('Kurs, o\'qituvchi, dars kunlari va vaqti, xona va sig\'im')}
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            {tr('Bekor qilish')}
          </Button>
          <Button type="submit" form="group-form" icon="check">
            {editing ? tr('Saqlash') : tr('Guruh ochish')}
          </Button>
        </>
      }
    >
      <form id="group-form" className="form" onSubmit={handleSubmit} noValidate>
        {errors.conflict && (
          <p id="group-conflict" className="notice notice-error" role="alert" tabIndex={-1}>
            {errors.conflict}
          </p>
        )}
        <Input
          id="group-name"
          label={tr('Guruh nomi')}
          required
          value={form.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder={tr('Masalan: IELTS — kechki')}
          autoComplete="off"
          data-autofocus
        />
        <div className="form-row">
          <Select id="group-courseId" label={tr('Kurs')} required value={form.courseId} error={errors.courseId} onChange={(e) => update('courseId', e.target.value)} options={[{ value: '', label: tr('Tanlang') }, ...courseOptions]} />
          <Select label={tr('O\'qituvchi')} value={form.teacherId} onChange={(e) => update('teacherId', e.target.value)} options={teacherOptions} />
        </div>
        <fieldset className="fieldset-plain field">
          <legend>
            {tr('Dars kunlari')}
            <span className="required" aria-hidden="true">
              {' '}
              *
            </span>
          </legend>
          <div className="day-picker" id="group-days" tabIndex={-1} aria-describedby={errors.days ? 'group-days-error' : undefined}>
            {WEEKDAYS.map((day) => (
              <button key={day} type="button" aria-pressed={form.days.includes(day)} aria-label={WEEKDAY_LONG[day]} title={WEEKDAY_LONG[day]} onClick={() => toggleDay(day)}>
                {WEEKDAY_SHORT[day]}
              </button>
            ))}
          </div>
          {errors.days && (
            <small id="group-days-error" className="field-error" role="alert">
              {errors.days}
            </small>
          )}
        </fieldset>
        <div className="form-row">
          <Input id="group-startTime" label={tr('Boshlanishi')} type="time" required value={form.startTime} error={errors.startTime} onChange={(e) => update('startTime', e.target.value)} />
          <Input id="group-endTime" label={tr('Tugashi')} type="time" required value={form.endTime} error={errors.endTime} onChange={(e) => update('endTime', e.target.value)} />
        </div>
        <div className="form-row">
          <Input id="group-room" label={tr('Xona')} value={form.room} onChange={(e) => update('room', e.target.value)} placeholder={tr('Masalan: 101-xona')} maxLength={40} />
          <Input
            id="group-capacity"
            label={tr('Sig\'im (o\'rin)')}
            type="number"
            min={1}
            max={500}
            inputMode="numeric"
            required
            value={form.capacity}
            error={errors.capacity}
            hint={editing && taken > Number(form.capacity) ? tr('Hozir guruhda {0} o\'quvchi — sig\'imdan ko\'p', { 0: taken }) : undefined}
            onChange={(e) => update('capacity', e.target.value)}
          />
        </div>
        <div className="form-row">
          <DateInput id="group-startDate" label={tr('Boshlanish sanasi')} required value={form.startDate} error={errors.startDate} format={settings.dateFormat} onChange={(v) => update('startDate', v)} />
          <DateInput id="group-endDate" label={tr('Tugash sanasi')} value={form.endDate} error={errors.endDate} format={settings.dateFormat} hint={tr('Ixtiyoriy')} onChange={(v) => update('endDate', v)} />
        </div>
        {editing && (
          <Select
            label={tr('Holati')}
            value={form.status}
            onChange={(e) => update('status', e.target.value as GroupStatus)}
            options={(Object.keys(GROUP_STATUS_LABELS) as GroupStatus[]).map((s) => ({ value: s, label: GROUP_STATUS_LABELS[s] }))}
          />
        )}
      </form>
    </Modal>
  )
}
