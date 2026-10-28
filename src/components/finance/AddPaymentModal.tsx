import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon, METHOD_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { PaymentMethod, TransactionType } from '../../types/finance.types'
import { todayInputValue } from '../../utils/format'

interface PaymentForm {
  type: TransactionType
  amount: string
  method: PaymentMethod
  customerId: string
  note: string
  date: string
}

export function AddPaymentModal({ customerId }: { customerId?: string }) {
  const { customers, addTransaction, closeModal } = useDashboard()
  const [form, setForm] = useState<PaymentForm>(() => ({
    type: 'income',
    amount: '',
    method: 'payme',
    customerId: customerId ?? '',
    note: '',
    date: todayInputValue(),
  }))
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal])

  const update = <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amount = Number(form.amount.replace(/\s/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Summa 0 dan katta bo\'lishi kerak')
      return
    }
    // Bugungi sana uchun joriy vaqt, boshqa kunlar uchun kun o'rtasi olinadi
    const date = form.date === todayInputValue() || !form.date ? new Date() : new Date(`${form.date}T12:00:00`)

    addTransaction({
      type: form.type,
      amount: Math.round(amount),
      method: form.method,
      note: form.note.trim(),
      customerId: form.customerId || undefined,
      date: date.toISOString(),
    })
    closeModal()
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
        <div className="modal-head">
          <h2 id="payment-modal-title">To'lov qo'shish</h2>
          <button type="button" className="icon-btn" aria-label="Yopish" onClick={closeModal}>
            <Icon name="close" />
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="segmented segmented-full" role="group" aria-label="Turi">
            {(['income', 'expense'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={form.type === type ? 'is-active' : undefined}
                onClick={() => update('type', type)}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <label className="field">
            <span>Summa *</span>
            <input
              className={`input${error ? ' has-error' : ''}`}
              type="number"
              inputMode="numeric"
              min={0}
              value={form.amount}
              onChange={(e) => update('amount', e.target.value)}
              placeholder="Masalan: 650000"
              autoFocus
            />
            {error && <small className="error">{error}</small>}
          </label>

          <div className="form-row">
            <label className="field">
              <span>To'lov usuli</span>
              <select className="input" value={form.method} onChange={(e) => update('method', e.target.value as PaymentMethod)}>
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Sana</span>
              <input className="input" type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
            </label>
          </div>

          <label className="field">
            <span>Mijoz (ixtiyoriy)</span>
            <select className="input" value={form.customerId} onChange={(e) => update('customerId', e.target.value)}>
              <option value="">— Tanlanmagan —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Izoh</span>
            <input
              className="input"
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              placeholder="Masalan: IELTS - 1-oy to'lovi"
            />
          </label>

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
