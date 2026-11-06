import { tr } from '../../i18n'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import type { CourseInput, CourseStatus, CourseType } from '../../types/course.types'
import { COURSE_STATUS_LABELS, COURSE_TYPE_LABELS, validateCourse } from '../../utils/courses'
import type { CourseFormErrors } from '../../utils/courses'
import { toOptions } from '../../utils/cx'
import { formatAmountInput, parseAmount } from '../../utils/format'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

interface FormState {
  name: string
  type: CourseType
  durationMonths: string
  monthlyPrice: string
  activeGroups: string
  status: CourseStatus
}

const FIELD_ORDER = ['name', 'durationMonths', 'monthlyPrice', 'activeGroups'] as const

// Bo'sh yoki noto'g'ri raqam NaN bo'ladi — tekshiruv xato beradi
function toInt(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}

export function CourseFormModal({ courseId }: { courseId?: string }) {
  const { courses, customers, getCourse, addCourse, updateCourse, closeModal } = useDashboard()
  const editing = getCourse(courseId)
  const [form, setForm] = useState<FormState>(() => ({
    name: editing?.name ?? '',
    type: editing?.type ?? 'course',
    durationMonths: String(editing?.durationMonths ?? 3),
    monthlyPrice: editing ? formatAmountInput(String(editing.monthlyPrice)) : '',
    activeGroups: String(editing?.activeGroups ?? 1),
    status: editing?.status ?? 'active',
  }))
  const [errors, setErrors] = useState<CourseFormErrors>({})
  const affected = editing ? customers.filter((c) => c.course === editing.name).length : 0

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data: CourseInput = {
      name: form.name,
      type: form.type,
      durationMonths: toInt(form.durationMonths),
      monthlyPrice: form.monthlyPrice.trim() === '' ? 0 : parseAmount(form.monthlyPrice),
      activeGroups: toInt(form.activeGroups),
      status: form.status,
    }
    const next = validateCourse(data, courses, editing?.id)
    setErrors(next)
    const first = FIELD_ORDER.find((key) => next[key])
    if (first) {
      document.getElementById(`course-${first}`)?.focus()
      return
    }
    if (editing) updateCourse(editing.id, data)
    else addCourse(data)
    closeModal()
  }

  return (
    <Modal
      title={editing ? tr('Kursni tahrirlash') : tr('Yangi kurs yoki xizmat')}
      description={editing ? editing.name : tr('Narx qarz va kutilayotgan tushum hisobida ishlatiladi')}
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            {tr('Bekor qilish')}
          </Button>
          <Button type="submit" form="course-form" icon="check">
            {editing ? tr('Saqlash') : tr('Qo\'shish')}
          </Button>
        </>
      }
    >
      <form id="course-form" className="form" onSubmit={handleSubmit} noValidate>
        <Input
          id="course-name"
          label={tr('Nomi')}
          required
          value={form.name}
          error={errors.name}
          hint={editing && affected > 0 ? tr('Nom o\'zgarsa, {0} ta mijozdagi kurs nomi ham yangilanadi', { 0: affected }) : undefined}
          onChange={(e) => update('name', e.target.value)}
          placeholder={tr('Masalan: Ingliz tili (IELTS)')}
          autoComplete="off"
          data-autofocus
        />
        <div className="form-row">
          <Select label={tr('Turi')} value={form.type} onChange={(e) => update('type', e.target.value as CourseType)} options={toOptions(COURSE_TYPE_LABELS)} />
          <Input
            id="course-durationMonths"
            label={tr('Davomiyligi (oy)')}
            required
            type="number"
            min={0}
            max={60}
            hint={tr('0 — muddatsiz (tugash sanasi yo\'q)')}
            inputMode="numeric"
            value={form.durationMonths}
            error={errors.durationMonths}
            onChange={(e) => update('durationMonths', e.target.value)}
          />
        </div>
        <div className="form-row">
          <Input
            id="course-monthlyPrice"
            label={tr('Oylik narxi')}
            inputMode="numeric"
            value={form.monthlyPrice}
            error={errors.monthlyPrice}
            hint={tr('Bo\'sh bo\'lsa 0 — keyin kiritish mumkin')}
            onChange={(e) => update('monthlyPrice', formatAmountInput(e.target.value))}
            placeholder="650 000"
          />
          <Input
            id="course-activeGroups"
            label={tr('Faol guruhlar soni')}
            type="number"
            min={0}
            inputMode="numeric"
            value={form.activeGroups}
            error={errors.activeGroups}
            onChange={(e) => update('activeGroups', e.target.value)}
          />
        </div>
        {editing && (
          <Select label={tr('Holati')} value={form.status} onChange={(e) => update('status', e.target.value as CourseStatus)} options={toOptions(COURSE_STATUS_LABELS)} />
        )}
      </form>
    </Modal>
  )
}
