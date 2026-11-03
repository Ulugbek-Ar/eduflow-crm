import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FUNNEL_STAGES, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { CustomerInput } from '../../types/customer.types'
import { toOptions } from '../../utils/cx'
import { courseChoices } from '../../utils/courses'
import { validateCustomer } from '../../utils/customers'
import type { CustomerFormErrors } from '../../utils/customers'
import { formatPhone } from '../../utils/phone'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

// Email formadan olib tashlangan (eski yozuvlarda saqlanib qoladi), lekin tekshiruv tartibi o'zgarmaydi
const FIELD_ORDER = ['name', 'phone', 'email'] as const

export function CustomerFormModal({ customerId }: { customerId?: string }) {
  const { customers, courses, getCustomer, addCustomer, updateCustomer, closeModal } = useDashboard()
  const editing = getCustomer(customerId)

  const [form, setForm] = useState<CustomerInput>(() => ({
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
    else addCustomer(form)
    closeModal()
  }

  const courseOptions = courseChoices(courses, editing?.course)

  return (
    <Modal
      title={editing ? 'Mijozni tahrirlash' : 'Yangi mijoz'}
      description={editing ? editing.name : 'Yangi lid "Yangi" bosqichiga qo\'shiladi'}
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            Bekor qilish
          </Button>
          <Button type="submit" form="customer-form" icon="check">
            {editing ? 'Saqlash' : 'Qo\'shish'}
          </Button>
        </>
      }
    >
      <form id="customer-form" className="form" onSubmit={handleSubmit} noValidate>
        <Input
          ref={nameRef}
          label="Ism familiya"
          required
          value={form.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Masalan: Aziza Karimova"
          autoComplete="off"
          data-autofocus
        />
        <div className="form-row">
          <Input
            ref={phoneRef}
            label="Telefon"
            required
            type="tel"
            inputMode="tel"
            value={form.phone}
            error={errors.phone}
            onChange={(e) => update('phone', formatPhone(e.target.value))}
            placeholder="+998 90 123 45 67"
          />
          <Select
            label="Manba"
            value={form.source}
            onChange={(e) => update('source', e.target.value as CustomerInput['source'])}
            options={toOptions(SOURCE_LABELS)}
          />
        </div>
        <div className="form-row">
          <Select
            label="Kurs / xizmat"
            value={form.course}
            onChange={(e) => update('course', e.target.value)}
            hint={courseOptions.length === 0 ? 'Avval "Kurslar va xizmatlar" bo\'limida kurs qo\'shing' : undefined}
            options={[{ value: '', label: 'Tanlanmagan' }, ...courseOptions.map((c) => ({ value: c, label: c }))]}
          />
          {editing && (
            <Select
              label="Bosqich"
              value={form.status}
              onChange={(e) => update('status', e.target.value as CustomerInput['status'])}
              options={FUNNEL_STAGES.map((stage) => ({ value: stage, label: STATUS_LABELS[stage] }))}
            />
          )}
        </div>
        <Textarea label="Izoh" rows={3} value={form.note ?? ''} onChange={(e) => update('note', e.target.value)} />
      </form>
    </Modal>
  )
}
