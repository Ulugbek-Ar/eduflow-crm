import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { COURSES } from '../../constants/mockData'
import { Icon, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { CustomerSource, CustomerStatus, NewCustomer } from '../../types/customer.types'

type Errors = Partial<Record<'name' | 'phone', string>>

const EMPTY_FORM: NewCustomer = {
  name: '',
  phone: '+998 ',
  course: COURSES[0],
  status: 'lead',
  source: 'telegram',
}

export function AddCustomerModal() {
  const { addCustomer, closeModal } = useDashboard()
  const [form, setForm] = useState<NewCustomer>(EMPTY_FORM)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal])

  const update = <K extends keyof NewCustomer>(key: K, value: NewCustomer[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: Errors = {}
    if (form.name.trim().length < 2) next.name = 'Ismni kiriting (kamida 2 ta belgi)'
    if (form.phone.replace(/\D/g, '').length < 9) next.phone = 'Telefon raqamini to\'liq kiriting'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    addCustomer({ ...form, name: form.name.trim(), phone: form.phone.trim() })
    closeModal()
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
        <div className="modal-head">
          <h2 id="customer-modal-title">Yangi mijoz</h2>
          <button type="button" className="icon-btn" aria-label="Yopish" onClick={closeModal}>
            <Icon name="close" />
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Ism familiya *</span>
            <input
              className={`input${errors.name ? ' has-error' : ''}`}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Masalan: Aziza Karimova"
              autoFocus
            />
            {errors.name && <small className="error">{errors.name}</small>}
          </label>

          <label className="field">
            <span>Telefon *</span>
            <input
              className={`input${errors.phone ? ' has-error' : ''}`}
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+998 90 123 45 67"
            />
            {errors.phone && <small className="error">{errors.phone}</small>}
          </label>

          <label className="field">
            <span>Kurs</span>
            <select className="input" value={form.course} onChange={(e) => update('course', e.target.value)}>
              {COURSES.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label className="field">
              <span>Holat</span>
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value as CustomerStatus)}>
                {(Object.keys(STATUS_LABELS) as CustomerStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Manba</span>
              <select className="input" value={form.source} onChange={(e) => update('source', e.target.value as CustomerSource)}>
                {(Object.keys(SOURCE_LABELS) as CustomerSource[]).map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              Bekor qilish
            </button>
            <button type="submit" className="btn btn-primary">
              Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
