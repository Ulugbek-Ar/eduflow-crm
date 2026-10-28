import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { CustomerInput } from '../../types/customer.types'
import { toOptions } from '../../utils/cx'
import { validateCustomer } from '../../utils/customers'
import type { CustomerFormErrors } from '../../utils/customers'
import { formatPhone } from '../../utils/phone'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

const FIELD_ORDER = ['name', 'phone', 'email'] as const

export function CustomerFormModal({ customerId }: { customerId?: string }) {
  const { customers, courses, getCustomer, addCustomer, updateCustomer, closeModal } = useDashboard()
  const editing = getCustomer(customerId)

  const [form, setForm] = useState<CustomerInput>(() => ({
    name: editing?.name ?? '',
    phone: editing?.phone ?? '+998',
    email: editing?.email ?? '',
    course: editing?.course ?? courses[0] ?? '',
    status: editing?.status ?? 'lead',
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

  const courseOptions = Array.from(new Set([...courses, form.course])).filter(Boolean)

  return (
    <Modal
      title={editing ? 'Mijozni tahrirlash' : 'Yangi mijoz'}
      description={editing ? editing.name : 'Lead yoki o\'quvchi ma\'lumotlarini kiriting'}
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
          <Input
            ref={emailRef}
            label="Email"
            type="email"
            value={form.email ?? ''}
            error={errors.email}
            hint="Ixtiyoriy"
            onChange={(e) => update('email', e.target.value)}
            placeholder="ism@misol.uz"
          />
        </div>
        <Select
          label="Kurs"
          value={form.course}
          onChange={(e) => update('course', e.target.value)}
          options={courseOptions.map((c) => ({ value: c, label: c }))}
        />
        <div className="form-row">
          <Select
            label="Holat"
            value={form.status}
            onChange={(e) => update('status', e.target.value as CustomerInput['status'])}
            options={toOptions(STATUS_LABELS)}
          />
          <Select
            label="Manba"
            value={form.source}
            onChange={(e) => update('source', e.target.value as CustomerInput['source'])}
            options={toOptions(SOURCE_LABELS)}
          />
        </div>
        <Textarea label="Izoh" rows={3} value={form.note ?? ''} onChange={(e) => update('note', e.target.value)} />
      </form>
    </Modal>
  )
}
