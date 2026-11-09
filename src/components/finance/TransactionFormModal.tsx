import { getLang, tr } from '../../i18n'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CATEGORY_LABELS, categoriesFor, METHOD_LABELS, SOURCE_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useFormDraft } from '../../hooks/useFormDraft'
import type { CustomerSource } from '../../types/customer.types'
import type { PaymentMethod, TransactionCategory, TransactionInput, TransactionStatus, TransactionType } from '../../types/finance.types'
import { cx, toOptions } from '../../utils/cx'
import { customerDebt, remainderThrough } from '../../utils/debts'
import { formatAmountInput, parseAmount, toInputDate, todayInputValue } from '../../utils/format'
import { ENROLLMENT_STATUS_LABELS } from '../../utils/groups'
import { monthName } from '../../utils/reminders'
import type { TransactionFormErrors } from '../../utils/transactions'
import { Button } from '../ui/Button'
import { DraftNotice } from '../ui/DraftNotice'
import { Combobox } from '../ui/Combobox'
import { DateInput } from '../ui/DateInput'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { BranchSelect } from '../branches/BranchSelect'

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
  // Kirim qaysi o'qish (guruh) uchun; '' — avtomatik: to'lov sanasidagi shu kurs bo'yicha faol o'qish
  enrollmentId: string
  // Qaysi oy uchun ('YYYY-MM'); '' — ko'rsatilmagan
  period: string
  // v12: mijozsiz yozuv filiali ('' — umumiy). Mijoz to'lovida filial avtomatik (o'qish guruhi yoki o'quvchi)
  branchId: string
}

// 'YYYY-MM' -> "Noyabr 2026"
function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const name = monthName(new Date(y, m - 1, 1), getLang())
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}

// Joriy oydan 3 oy oldin va 2 oy keyin (tahrirlanayotgan to'lovning oyi ro'yxatda bo'lmasa, qo'shiladi)
function periodOptions(current: string, keep: string): string[] {
  const [y, m] = current.split('-').map(Number)
  const list: string[] = []
  for (let i = -3; i <= 2; i++) {
    const d = new Date(y, m - 1 + i, 1)
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  if (keep && !list.includes(keep)) list.push(keep)
  return list.sort()
}

const MAX_AMOUNT = 1_000_000_000_000

interface TransactionFormModalProps {
  transactionId?: string
  kind?: TransactionType
  customerId?: string
  // Qarzdorlar ro'yxatidan: qarz summasi oldindan to'ldiriladi
  amount?: number
  // Qaysi o'qish (guruh) va qaysi oy uchun — berilmasa, o'quvchining faol o'qishi va joriy oy
  enrollmentId?: string
  period?: string
}

export function TransactionFormModal({ transactionId, kind, customerId, amount: presetAmount, enrollmentId: presetEnrollment, period: presetPeriod }: TransactionFormModalProps) {
  const { customers, courses, transactions, getTransaction, addTransaction, updateTransaction, closeModal, settings, debtContext, branches, branchFilter, restrictedBranch } = useDashboard()
  const editing = getTransaction(transactionId)
  const thisPeriod = todayInputValue().slice(0, 7)
  const enrollmentsOf = (id: string) => (id ? (debtContext.enrollments ?? []).filter((e) => e.customerId === id) : [])
  // Standart: birinchi faol o'qish, bo'lmasa — eng oxirgisi
  const defaultEnrollment = (id: string) => {
    const own = enrollmentsOf(id)
    return (own.find((e) => e.status === 'active') ?? own.find((e) => e.status === 'paused') ?? own.at(-1))?.id ?? ''
  }
  // Tanlangan o'qish bo'yicha shu oy oxirigacha qoldiq (o'qishi yo'q mijozda — joriy oy qarzi)
  const remainderFor = (id: string, enrollment: string, period: string): number => {
    const customer = customers.find((c) => c.id === id)
    if (!customer) return 0
    const row = customerDebt(customer, courses, transactions, undefined, debtContext)
    if (!row) return 0
    const ledger = row.ledgers.find((l) => l.enrollment.id === enrollment)
    if (!ledger) return row.ledgers.length === 0 ? row.dueNow : 0
    return remainderThrough(ledger, period || thisPeriod, debtContext.settings ?? { prorateFirstMonth: false, paymentDueDay: 10 })
  }

  // Qoralama faqat bo'sh yangi formada (mijoz yoki summa oldindan berilmagan)
  const draftEnabled = !editing && !customerId && !presetAmount
  const { form, setForm, restored, discard, clear } = useFormDraft<FormState>(`transaction-${kind ?? 'income'}`, draftEnabled, () => {
    const type = editing?.type ?? kind ?? 'income'
    const enrollmentId = editing ? (editing.enrollmentId ?? '') : customerId ? (presetEnrollment ?? defaultEnrollment(customerId)) : ''
    const period = editing ? (editing.period ?? '') : type === 'income' ? (presetPeriod ?? thisPeriod) : ''
    // Mijoz oldindan tanlangan bo'lsa (qarzdorlar, mijoz kartasi) — shu guruh va oy qoldig'i
    const suggested = !editing && !presetAmount && customerId && type === 'income' ? remainderFor(customerId, enrollmentId, period) : 0
    const initialAmount = editing ? editing.amount : (presetAmount ?? suggested)
    return {
      type,
      amount: initialAmount ? formatAmountInput(String(initialAmount)) : '',
      method: editing?.method ?? 'card',
      category: editing?.category ?? categoriesFor(type)[0],
      customerId: editing?.customerId ?? customerId ?? '',
      note: editing?.note ?? '',
      date: editing ? toInputDate(editing.date) : todayInputValue(),
      status: editing?.status ?? 'paid',
      source: editing?.source ?? '',
      enrollmentId,
      period,
      // Butun markaz ko'rinishida xarajat — umumiy (filialni taxmin qilmaymiz)
      branchId: editing ? (editing.branchId ?? '') : (restrictedBranch ?? branchFilter),
    }
  })
  const [errors, setErrors] = useState<TransactionFormErrors>({})
  // Summa qo'lda yozilsa (yoki tahrirlashda), guruh/oy almashganda qayta to'ldirilmaydi
  const [amountTouched, setAmountTouched] = useState(() => Boolean(editing || presetAmount) || (!customerId && form.amount !== ''))
  const amountRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const today = todayInputValue()

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // Mijoz, guruh yoki oy o'zgarganda: summa — shu guruh bo'yicha tanlangan oy oxirigacha qoldiq
  const refill = (patch: Partial<Pick<FormState, 'customerId' | 'enrollmentId' | 'period'>>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if ('customerId' in patch) next.enrollmentId = defaultEnrollment(next.customerId)
      if (amountTouched || next.type !== 'income' || !next.customerId) return next
      const remainder = remainderFor(next.customerId, next.enrollmentId, next.period)
      return { ...next, amount: remainder > 0 ? formatAmountInput(String(remainder)) : '' }
    })
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
    if (amount <= 0) next.amount = tr('Summa 0 dan katta bo\'lishi kerak')
    else if (amount > MAX_AMOUNT) next.amount = tr('Summa juda katta')
    if (!form.date) next.date = tr('Sanani tanlang')
    // Kutilayotgan to'lov kelajakda bo'lishi mumkin; to'langan yoki bekor qilingan — yo'q
    else if (form.date > today && form.status !== 'pending') next.date = tr('Kelajakdagi sana faqat "Kutilmoqda" statusida')
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
    // Kirim: guruh va oy (chiqimda maosh oyi va o'qituvchi o'zgarmaydi — bu formada ko'rsatilmaydi)
    if (form.type === 'income') {
      data.enrollmentId = form.customerId && enrollmentsOf(form.customerId).some((e) => e.id === form.enrollmentId) ? form.enrollmentId : undefined
      data.period = form.period || undefined
      data.teacherId = undefined
    } else if (editing?.type === 'income') {
      data.enrollmentId = undefined
      data.period = undefined
    }
    // Mijozsiz yozuv: tanlangan filial ('' — umumiy); mijoz to'lovida filialni DashboardContext aniqlaydi
    if (branches.length > 0 && !data.customerId) data.branchId = form.branchId
    if (editing) updateTransaction(editing.id, data)
    else {
      addTransaction(data)
      clear()
    }
    closeModal()
  }

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name, description: `${c.phone} · ${c.course}` }))
  const ownEnrollments = form.type === 'income' ? enrollmentsOf(form.customerId) : []
  const groupName = (groupId: string) => (debtContext.groups ?? []).find((g) => g.id === groupId)?.name ?? '—'

  return (
    <Modal
      title={editing ? tr('Tranzaksiyani tahrirlash') : form.type === 'income' ? tr('To\'lov qabul qilish') : tr('Xarajat yozish')}
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            {tr('Bekor qilish')}
          </Button>
          <Button type="submit" form="transaction-form" icon="check">
            {tr('Saqlash')}
          </Button>
        </>
      }
    >
      <form id="transaction-form" className="form" onSubmit={handleSubmit} noValidate>
        {restored && <DraftNotice onDiscard={discard} />}
        <div className="segmented segmented-full" role="group" aria-label={tr('Tranzaksiya turi')}>
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
            label={tr('Summa')}
            required
            inputMode="numeric"
            value={form.amount}
            error={errors.amount}
            // Payme/Click orqali kelgan kirim summasi provayderdagi bilan bir xil qolishi kerak
            readOnly={Boolean(editing?.provider)}
            hint={editing?.provider ? tr('{0} orqali kelgan — summani o\'zgartirib bo\'lmaydi', { 0: editing.provider === 'payme' ? 'Payme' : 'Click' }) : undefined}
            onChange={(e) => {
              setAmountTouched(true)
              update('amount', formatAmountInput(e.target.value))
            }}
            placeholder="650 000"
            data-autofocus
          />
          <DateInput
            ref={dateRef}
            label={tr('Sana')}
            required
            format={settings.dateFormat}
            max={form.status === 'pending' ? undefined : today}
            hint={form.status === 'pending' ? tr('Kutilayotgan to\'lov sanasi kelajakda bo\'lishi mumkin') : undefined}
            value={form.date}
            error={errors.date}
            onChange={(value) => update('date', value)}
          />
        </div>

        <div className="form-row">
          <Select
            label={tr('Kategoriya')}
            value={form.category}
            onChange={(e) => update('category', e.target.value as TransactionCategory)}
            options={categoriesFor(form.type).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          />
          <Select
            label={tr('To\'lov turi')}
            value={form.method}
            onChange={(e) => update('method', e.target.value as PaymentMethod)}
            options={toOptions(METHOD_LABELS)}
          />
        </div>

        <div className="form-row">
          <Select
            label={tr('Status')}
            value={form.status}
            hint={form.status === 'paid' ? undefined : tr('Balans va hisobotlarga faqat "To\'langan" kiradi')}
            onChange={(e) => update('status', e.target.value as TransactionStatus)}
            options={toOptions(TX_STATUS_LABELS)}
          />
          {form.type === 'expense' && form.category === 'marketing' && (
            <Select
              label={tr('Manba')}
              value={form.source}
              hint={tr('Ixtiyoriy — CPL va ROI hisobi uchun')}
              onChange={(e) => update('source', e.target.value as FormState['source'])}
              options={[{ value: '', label: tr('Ko\'rsatilmagan') }, ...toOptions(SOURCE_LABELS)]}
            />
          )}
        </div>

        {form.type === 'income' && (
          <Combobox
            label={tr('Mijoz')}
            options={customerOptions}
            value={form.customerId}
            onChange={(value) => refill({ customerId: value })}
            placeholder={tr('Ism yoki telefon bo\'yicha qidiring')}
            hint={tr('Ixtiyoriy')}
          />
        )}

        {form.type === 'income' && (
          <div className="form-row">
            {ownEnrollments.length > 0 && (
              <Select
                label={tr('Guruh')}
                value={form.enrollmentId}
                hint={tr('To\'lov shu guruhdagi o\'qish qarzidan ayriladi')}
                onChange={(e) => refill({ enrollmentId: e.target.value })}
                options={ownEnrollments.map((e) => ({
                  value: e.id,
                  label: e.status === 'active' ? groupName(e.groupId) : `${groupName(e.groupId)} (${ENROLLMENT_STATUS_LABELS[e.status].toLowerCase()})`,
                }))}
              />
            )}
            <Select
              label={tr('Qaysi oy uchun')}
              value={form.period}
              onChange={(e) => refill({ period: e.target.value })}
              options={[...periodOptions(thisPeriod, form.period).map((p) => ({ value: p, label: periodLabel(p) })), { value: '', label: tr('Ko\'rsatilmagan') }]}
            />
          </div>
        )}

        {!(form.type === 'income' && form.customerId) && (
          <BranchSelect value={form.branchId} noneLabel={tr('Umumiy (filialsiz)')} hint={form.branchId ? undefined : tr('Faqat butun markazni ko\'radigan xodimlarga ko\'rinadi')} onChange={(v) => update('branchId', v)} />
        )}

        <Input
          label={tr('Izoh')}
          value={form.note}
          onChange={(e) => update('note', e.target.value)}
          placeholder={form.type === 'income' ? tr('Masalan: IELTS - 1-oy to\'lovi') : tr('Masalan: Xona ijarasi')}
        />
      </form>
    </Modal>
  )
}
