import { tr } from '../../i18n'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FUNNEL_STAGES, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useFormDraft } from '../../hooks/useFormDraft'
import type { CustomerInput } from '../../types/customer.types'
import { toOptions } from '../../utils/cx'
import { courseChoices } from '../../utils/courses'
import { validateCustomer } from '../../utils/customers'
import type { CustomerFormErrors } from '../../utils/customers'
import { formatPhone } from '../../utils/phone'
import { Button } from '../ui/Button'
import { DraftNotice } from '../ui/DraftNotice'
import { Input, Textarea } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

// Email formadan olib tashlangan (eski yozuvlarda saqlanib qoladi), lekin tekshiruv tartibi o'zgarmaydi
const FIELD_ORDER = ['name', 'phone', 'email'] as const

export function CustomerFormModal({ customerId }: { customerId?: string }) {
  const { customers, courses, getCustomer, addCustomer, updateCustomer, closeModal } = useDashboard()
  const editing = getCustomer(customerId)

  const { form, setForm, restored, discard, clear } = useFormDraft<CustomerInput>('customer', !editing, () => ({
    name: editing?.name ?? '',
    phone: editing?.phone ?? '+998',
    email: editing?.email ?? '',
    course: editing?.course ?? courseChoices(courses)[0] ?? '',
    // Yangi mijoz voronkaning birinchi bosqichidan boshlanadi
    status: editing?.status ?? 'new',
    source: editing?.source ?? 'telegram',
    note: editing?.note ?? '',
  }))
  const [errors, setErrors] = useState<CustomerFormErrors>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const update = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = validateCustomer(form, customers, editing?.id)
    setErrors(next)
    const firstInvalid = FIELD_ORDER.find((key) => next[key])
    if (firstInvalid) {
      const fieldRefs = { name: nameRef, phone: phoneRef, email: emailRef }
      fieldRefs[firstInvalid].current?.focus()
      return
    }
    if (editing) updateCustomer(editing.id, form)
    else {
      addCustomer(form)
      clear()
    }
    closeModal()
  }

  const courseOptions = courseChoices(courses, editing?.course)

  return (
    <Modal
      title={editing ? tr('Mijozni tahrirlash') : tr('Yangi mijoz')}
      description={editing ? editing.name : tr('Yangi lid "Yangi" bosqichiga qo\'shiladi')}
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            {tr('Bekor qilish')}
          </Button>
          <Button type="submit" form="customer-form" icon="check">
            {editing ? tr('Saqlash') : tr('Qo\'shish')}
          </Button>
        </>
      }
    >
      <form id="customer-form" className="form" onSubmit={handleSubmit} noValidate>
        {restored && <DraftNotice onDiscard={discard} />}
        <Input
          ref={nameRef}
          label={tr('Ism familiya')}
          required
          value={form.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder={tr('Masalan: Aziza Karimova')}
          autoComplete="off"
          data-autofocus
        />
        <div className="form-row">
          <Input
            ref={phoneRef}
            label={tr('Telefon')}
            required
            type="tel"
            inputMode="tel"
            value={form.phone}
            error={errors.phone}
            onChange={(e) => update('phone', formatPhone(e.target.value))}
            placeholder="+998 90 123 45 67"
          />
          <Select
            label={tr('Manba')}
            value={form.source}
            onChange={(e) => update('source', e.target.value as CustomerInput['source'])}
            options={toOptions(SOURCE_LABELS)}
          />
        </div>
        <div className="form-row">
          <Select
            label={tr('Kurs / xizmat')}
            value={form.course}
            onChange={(e) => update('course', e.target.value)}
            hint={courseOptions.length === 0 ? tr('Avval "Kurslar va xizmatlar" bo\'limida kurs qo\'shing') : undefined}
            options={[{ value: '', label: tr('Tanlanmagan') }, ...courseOptions.map((c) => ({ value: c, label: c }))]}
          />
          {editing && (
            <Select
              label={tr('Bosqich')}
              value={form.status}
              onChange={(e) => update('status', e.target.value as CustomerInput['status'])}
              options={FUNNEL_STAGES.map((stage) => ({ value: stage, label: STATUS_LABELS[stage] }))}
            />
          )}
        </div>
        <Textarea label={tr('Izoh')} rows={3} value={form.note ?? ''} onChange={(e) => update('note', e.target.value)} />
      </form>
    </Modal>
  )
}
