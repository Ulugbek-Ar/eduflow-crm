import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { tr } from '../../i18n'
import type { PayRule, PayRuleType, TeacherInput, TeacherStatus } from '../../types/teacher.types'
import { formatAmountInput, parseAmount } from '../../utils/format'
import { formatPhone } from '../../utils/phone'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

type Field = 'name' | 'phone' | 'value'

const RULE_LABELS: Record<PayRuleType, string> = {
  fixed: tr('Belgilangan oylik'),
  percent: tr('Guruhlari tushumidan foiz'),
  perStudent: tr('Har bir faol o\'quvchi uchun'),
}

function ruleValue(rule?: PayRule): string {
  if (!rule) return ''
  return rule.type === 'percent' ? String(rule.percent) : formatAmountInput(String(rule.amount))
}

export function TeacherFormModal({ teacherId }: { teacherId?: string }) {
  const { getTeacher, addTeacher, updateTeacher, closeModal, teachers } = useDashboard()
  const editing = getTeacher(teacherId)
  const [name, setName] = useState(editing?.name ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [subjects, setSubjects] = useState(editing?.subjects.join(', ') ?? '')
  const [type, setType] = useState<PayRuleType>(editing?.payRule.type ?? 'percent')
  const [value, setValue] = useState(ruleValue(editing?.payRule) || (editing ? '' : '40'))
  const [status, setStatus] = useState<TeacherStatus>(editing?.status ?? 'active')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Partial<Record<Field, string>> = {}
    const clean = name.trim().replace(/\s+/g, ' ')
    if (clean.length < 2 || clean.length > 80) next.name = tr('Ism familiyani kiriting (2–80 belgi)')
    else if (teachers.some((t) => t.id !== editing?.id && t.name.toLowerCase() === clean.toLowerCase())) next.name = tr('Bu ismli o\'qituvchi bor')
    if (phone.trim() && phone.replace(/\D/g, '').length < 12) next.phone = tr('Telefon +998 XX XXX XX XX formatida bo\'lishi kerak')
    const amount = type === 'percent' ? Number(value.replace(',', '.')) : parseAmount(value)
    if (!Number.isFinite(amount) || amount < 0 || (type === 'percent' && amount > 100)) next.value = type === 'percent' ? tr('Foiz 0 dan 100 gacha') : tr('Summa 0 yoki musbat son bo\'lishi kerak')
    setErrors(next)
    if (Object.keys(next).length) {
      document.querySelector<HTMLElement>(`#teacher-form [name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }
    const payRule: PayRule = type === 'percent' ? { type, percent: amount } : { type, amount: Math.round(amount) }
    const input: TeacherInput = {
      name: clean,
      phone: phone.trim(),
      subjects: subjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      payRule,
      userId: editing?.userId,
      status,
    }
    if (editing) updateTeacher(editing.id, input)
    else addTeacher(input)
    closeModal()
  }

  return (
    <Modal
      title={editing ? tr('O\'qituvchini tahrirlash') : tr('Yangi o\'qituvchi')}
      description={tr('Maosh qoidasi "Maosh" sahifasida oy bo\'yicha hisoblanadi')}
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            {tr('Bekor qilish')}
          </Button>
          <Button type="submit" form="teacher-form" icon="check">
            {editing ? tr('Saqlash') : tr('Qo\'shish')}
          </Button>
        </>
      }
    >
      <form id="teacher-form" className="form" onSubmit={submit} noValidate>
        <div className="form-row">
          <Input name="name" label={tr('Ism familiya')} required value={name} error={errors.name} onChange={(e) => setName(e.target.value)} data-autofocus autoComplete="off" />
          <Input
            name="phone"
            label={tr('Telefon')}
            type="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            value={phone}
            error={errors.phone}
            onChange={(e) => setPhone(e.target.value.trim() ? formatPhone(e.target.value) : '')}
          />
        </div>
        <Input label={tr('Fanlar')} value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder={tr('Masalan: Ingliz tili, IELTS')} hint={tr('Vergul bilan ajrating')} />
        <div className="form-row">
          <Select label={tr('Maosh qoidasi')} value={type} onChange={(e) => setType(e.target.value as PayRuleType)} options={(Object.keys(RULE_LABELS) as PayRuleType[]).map((k) => ({ value: k, label: RULE_LABELS[k] }))} />
          <Input
            name="value"
            label={type === 'percent' ? tr('Foiz, %') : tr('Summa')}
            inputMode={type === 'percent' ? 'decimal' : 'numeric'}
            value={value}
            error={errors.value}
            onChange={(e) => setValue(type === 'percent' ? e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) : formatAmountInput(e.target.value))}
            hint={type === 'percent' ? tr('Guruhlaridan yig\'ilgan to\'langan kirimdan') : type === 'perStudent' ? tr('Oyda kamida bir kun o\'qigan har bir o\'quvchi uchun') : tr('Har oy')}
          />
        </div>
        {editing && (
          <Select
            label={tr('Holati')}
            value={status}
            onChange={(e) => setStatus(e.target.value as TeacherStatus)}
            options={[
              { value: 'active', label: tr('Faol') },
              { value: 'archived', label: tr('Arxiv') },
            ]}
          />
        )}
      </form>
    </Modal>
  )
}
