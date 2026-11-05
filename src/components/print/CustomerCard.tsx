import { METHOD_LABELS, SOURCE_LABELS, STATUS_LABELS, TX_STATUS_LABELS, TYPE_LABELS } from '../../constants/navigation'
import type { Customer } from '../../types/customer.types'
import type { Settings } from '../../types/dashboard.types'
import type { Transaction } from '../../types/finance.types'
import type { DebtRow } from '../../utils/debts'
import { formatDateTimeWith, formatDateWith } from '../../utils/format'

interface CustomerCardProps {
  customer: Customer
  payments: readonly Transaction[]
  debt: DebtRow | null
  totalPaid: number
  settings: Settings
  money: (amount: number) => string
  printedBy: string
  printedAt: string
}

// Mijoz kartasi (A4): ma'lumotlar, qarz holati va to'lovlar tarixi — ota-onaga berish yoki arxiv uchun
export function CustomerCard({ customer, payments, debt, totalPaid, settings, money, printedBy, printedAt }: CustomerCardProps) {
  const date = (iso: string) => formatDateWith(iso, settings.dateFormat)
  return (
    <article className="print-card" aria-label="Mijoz kartasi">
      <header className="print-card-head">
        <div>
          <strong className="receipt-org">{settings.orgName}</strong>
          <span>{[settings.address, settings.phone].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="print-card-title">
          <strong>Mijoz kartasi</strong>
          <span>{formatDateTimeWith(printedAt, settings.dateFormat)}</span>
        </div>
      </header>

      <h1>{customer.name}</h1>
      <dl className="print-grid">
        <div>
          <dt>Telefon</dt>
          <dd>{customer.phone}</dd>
        </div>
        <div>
          <dt>Kurs</dt>
          <dd>{customer.course || '—'}</dd>
        </div>
        <div>
          <dt>Bosqich</dt>
          <dd>{STATUS_LABELS[customer.status]}</dd>
        </div>
        <div>
          <dt>Qayerdan kelgan</dt>
          <dd>{SOURCE_LABELS[customer.source]}</dd>
        </div>
        <div>
          <dt>Qo'shilgan</dt>
          <dd>{date(customer.createdAt)}</dd>
        </div>
        {customer.paidAt && (
          <div>
            <dt>O'qishni boshlagan</dt>
            <dd>{date(customer.paidAt)}</dd>
          </div>
        )}
        {customer.email && (
          <div>
            <dt>Email</dt>
            <dd>{customer.email}</dd>
          </div>
        )}
        {customer.note && (
          <div className="print-wide">
            <dt>Izoh</dt>
            <dd>{customer.note}</dd>
          </div>
        )}
      </dl>

      <div className="print-summary">
        <div>
          <span>Jami to'lagan</span>
          <strong>{money(totalPaid)}</strong>
        </div>
        {debt && (
          <>
            <div>
              <span>Shu oygacha kutilgan</span>
              <strong>{money(debt.expected)}</strong>
            </div>
            <div>
              <span>Qarz</span>
              <strong>{debt.debt > 0 ? money(debt.debt) : 'Yo\'q'}</strong>
            </div>
          </>
        )}
      </div>

      <h2>To'lovlar tarixi</h2>
      {payments.length === 0 ? (
        <p>Hali to'lov qayd etilmagan.</p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th>Sana</th>
              <th>Turi</th>
              <th>Izoh</th>
              <th>To'lov turi</th>
              <th>Status</th>
              <th className="align-right">Summa</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((t) => (
              <tr key={t.id}>
                <td>{date(t.date)}</td>
                <td>{TYPE_LABELS[t.type]}</td>
                <td>{t.note || '—'}</td>
                <td>{METHOD_LABELS[t.method]}</td>
                <td>{TX_STATUS_LABELS[t.status]}</td>
                <td className="align-right">{money(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="print-card-foot">
        <span>Tayyorladi: {printedBy || '—'}</span>
        <span className="receipt-line" aria-hidden="true" />
      </footer>
    </article>
  )
}
