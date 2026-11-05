import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CATEGORY_LABELS, categoriesFor, METHOD_LABELS, SOURCE_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { CustomerSource } from '../../types/customer.types'
import type { PaymentMethod, TransactionCategory, TransactionInput, TransactionStatus, TransactionType } from '../../types/finance.types'
import { cx, toOptions } from '../../utils/cx'
import { formatAmountInput, parseAmount, toInputDate, todayInputValue } from '../../utils/format'
import type { TransactionFormErrors } from '../../utils/transactions'
import { Button } from '../ui/Button'
import { Combobox } from '../ui/Combobox'
import { DateInput } from '../ui/DateInput'
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
  status: TransactionStatus
  // Faqat marketing chiqimida; '' — ko'rsatilmagan
  source: CustomerSource | ''
}

const MAX_AMOUNT = 1_000_000_000_000

interface TransactionFormModalProps {
  transactionId?: string
  kind?: TransactionType
  customerId?: string
  // Qarzdorlar ro'yxatidan: qarz summasi oldindan to'ldiriladi
  amount?: number
}

export function TransactionFormModal({ transactionId, kind, customerId, amount: presetAmount }: TransactionFormModalProps) {
  const { customers, getTransaction, addTransaction, updateTransaction, closeModal, settings } = useDashboard()
  const editing = getTransaction(transactionId)

  const [form, setForm] = useState<FormState>(() => {
    const type = editing?.type ?? kind ?? 'income'
    return {
      type,
      amount: editing ? formatAmountInput(String(editing.amount)) : presetAmount ? formatAmountInput(String(presetAmount)) : '',
      method: editing?.method ?? 'card',
      category: editing?.category ?? categoriesFor(type)[0],
      customerId: editing?.customerId ?? customerId ?? '',
      note: editing?.note ?? '',
      date: editing ? toInputDate(editing.date) : todayInputValue(),
      status: editing?.status ?? 'paid',
      source: editing?.source ?? '',
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
    // Kutilayotgan to'lov kelajakda bo'lishi mumkin; to'langan yoki bekor qilingan — yo'q
    else if (form.date > today && form.status !== 'pending') next.date = 'Kelajakdagi sana faqat "Kutilmoqda" statusida'
    setErrors(next)
    if (next.amount) return amountRef.current?.focus()
    if (next.date) return dateRef.current?.focus()

    const data: TransactionInput = {
      type: form.type,
      amount,
      method: form.method,
      category: form.category,
      note: form.note,
      customerId: form.type === 'income' ? form.customerId || undefined : undefined,
      status: form.status,
      source: form.type === 'expense' && form.category === 'marketing' && form.source ? form.source : undefined,
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
          <DateInput
            ref={dateRef}
            label="Sana"
            required
            format={settings.dateFormat}
            max={form.status === 'pending' ? undefined : today}
            hint={form.status === 'pending' ? 'Kutilayotgan to\'lov sanasi kelajakda bo\'lishi mumkin' : undefined}
            value={form.date}
            error={errors.date}
            onChange={(value) => update('date', value)}
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
            label="To'lov turi"
            value={form.method}
            onChange={(e) => update('method', e.target.value as PaymentMethod)}
            options={toOptions(METHOD_LABELS)}
          />
        </div>

        <div className="form-row">
          <Select
            label="Status"
            value={form.status}
            hint={form.status === 'paid' ? undefined : 'Balans va hisobotlarga faqat "To\'langan" kiradi'}
            onChange={(e) => update('status', e.target.value as TransactionStatus)}
            options={toOptions(TX_STATUS_LABELS)}
          />
          {form.type === 'expense' && form.category === 'marketing' && (
            <Select
              label="Manba"
              value={form.source}
              hint="Ixtiyoriy — CPL va ROI hisobi uchun"
              onChange={(e) => update('source', e.target.value as FormState['source'])}
              options={[{ value: '', label: 'Ko\'rsatilmagan' }, ...toOptions(SOURCE_LABELS)]}
            />
          )}
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
