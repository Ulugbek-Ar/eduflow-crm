import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CATEGORY_LABELS, categoriesFor, METHOD_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { PaymentMethod, TransactionCategory, TransactionType } from '../../types/finance.types'
import { cx, toOptions } from '../../utils/cx'
import { formatAmountInput, parseAmount, toInputDate, todayInputValue } from '../../utils/format'
import type { TransactionFormErrors } from '../../utils/transactions'
import { Button } from '../ui/Button'
import { Combobox } from '../ui/Combobox'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

interface FormState {
  type: TransactionType
  amount: string
  method: PaymentMethod
  category: TransactionCategory
  customerId: string
  note: string
  date: string
}

const MAX_AMOUNT = 1_000_000_000_000

interface TransactionFormModalProps {
  transactionId?: string
  kind?: TransactionType
  customerId?: string
}

export function TransactionFormModal({ transactionId, kind, customerId }: TransactionFormModalProps) {
  const { customers, getTransaction, addTransaction, updateTransaction, closeModal } = useDashboard()
  const editing = getTransaction(transactionId)

  const [form, setForm] = useState<FormState>(() => {
    const type = editing?.type ?? kind ?? 'income'
    return {
      type,
      amount: editing ? formatAmountInput(String(editing.amount)) : '',
      method: editing?.method ?? 'payme',
      category: editing?.category ?? categoriesFor(type)[0],
      customerId: editing?.customerId ?? customerId ?? '',
      note: editing?.note ?? '',
      date: editing ? toInputDate(editing.date) : todayInputValue(),
    }
  })
  const [errors, setErrors] = useState<TransactionFormErrors>({})
  const amountRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const today = todayInputValue()

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const switchType = (type: TransactionType) => {
    setForm((prev) => ({
      ...prev,
      type,
      category: categoriesFor(type).includes(prev.category) ? prev.category : categoriesFor(type)[0],
    }))
  }

  const toIsoDate = (): string => {
    if (editing && form.date === toInputDate(editing.date)) return editing.date
    if (form.date === today) return new Date().toISOString()
    return new Date(`${form.date}T12:00:00`).toISOString()
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amount = parseAmount(form.amount)
    const next: TransactionFormErrors = {}
    if (amount <= 0) next.amount = 'Summa 0 dan katta bo\'lishi kerak'
    else if (amount > MAX_AMOUNT) next.amount = 'Summa juda katta'
    if (!form.date) next.date = 'Sanani tanlang'
    else if (form.date > today) next.date = 'Kelajakdagi sana kiritib bo\'lmaydi'
    setErrors(next)
    if (next.amount) return amountRef.current?.focus()
    if (next.date) return dateRef.current?.focus()

    const data = {
      type: form.type,
      amount,
      method: form.method,
      category: form.category,
      note: form.note,
      customerId: form.type === 'income' ? form.customerId || undefined : undefined,
      date: toIsoDate(),
    }
    if (editing) updateTransaction(editing.id, data)
    else addTransaction(data)
    closeModal()
  }

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name, description: `${c.phone} · ${c.course}` }))

  return (
    <Modal
      title={editing ? 'Tranzaksiyani tahrirlash' : form.type === 'income' ? 'To\'lov qabul qilish' : 'Xarajat yozish'}
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            Bekor qilish
          </Button>
          <Button type="submit" form="transaction-form" icon="check">
            Saqlash
          </Button>
        </>
      }
    >
      <form id="transaction-form" className="form" onSubmit={handleSubmit} noValidate>
        <div className="segmented segmented-full" role="group" aria-label="Tranzaksiya turi">
          {(['income', 'expense'] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={form.type === type}
              className={cx(form.type === type && 'is-active', `seg-${type}`)}
              onClick={() => switchType(type)}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="form-row">
          <Input
            ref={amountRef}
            label="Summa"
            required
            inputMode="numeric"
            value={form.amount}
            error={errors.amount}
            onChange={(e) => update('amount', formatAmountInput(e.target.value))}
            placeholder="650 000"
            data-autofocus
          />
          <Input
            ref={dateRef}
            label="Sana"
            required
            type="date"
            max={today}
            value={form.date}
            error={errors.date}
            onChange={(e) => update('date', e.target.value)}
          />
        </div>

        <div className="form-row">
          <Select
            label="Kategoriya"
            value={form.category}
            onChange={(e) => update('category', e.target.value as TransactionCategory)}
            options={categoriesFor(form.type).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          />
          <Select
            label="To'lov usuli"
            value={form.method}
            onChange={(e) => update('method', e.target.value as PaymentMethod)}
            options={toOptions(METHOD_LABELS)}
          />
        </div>

        {form.type === 'income' && (
          <Combobox
            label="Mijoz"
            options={customerOptions}
            value={form.customerId}
            onChange={(value) => update('customerId', value)}
            placeholder="Ism yoki telefon bo'yicha qidiring"
            hint="Ixtiyoriy"
          />
        )}

        <Input
          label="Izoh"
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
          placeholder={form.type === 'income' ? 'Masalan: IELTS - 1-oy to\'lovi' : 'Masalan: Xona ijarasi'}
        />
      </form>
    </Modal>
  )
}
