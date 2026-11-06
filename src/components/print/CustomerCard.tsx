import { tr } from '../../i18n'
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
    <article className="print-card" aria-label={tr('Mijoz kartasi')}>
      <header className="print-card-head">
        <div>
          <strong className="receipt-org">{settings.orgName}</strong>
          <span>{[settings.address, settings.phone].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="print-card-title">
          <strong>{tr('Mijoz kartasi')}</strong>
          <span>{formatDateTimeWith(printedAt, settings.dateFormat)}</span>
        </div>
      </header>

      <h1>{customer.name}</h1>
      <dl className="print-grid">
        <div>
          <dt>{tr('Telefon')}</dt>
          <dd>{customer.phone}</dd>
        </div>
        <div>
          <dt>{tr('Kurs')}</dt>
          <dd>{customer.course || '—'}</dd>
        </div>
        <div>
          <dt>{tr('Bosqich')}</dt>
          <dd>{STATUS_LABELS[customer.status]}</dd>
        </div>
        <div>
          <dt>{tr('Qayerdan kelgan')}</dt>
          <dd>{SOURCE_LABELS[customer.source]}</dd>
        </div>
        <div>
          <dt>{tr('Qo\'shilgan')}</dt>
          <dd>{date(customer.createdAt)}</dd>
        </div>
        {customer.paidAt && (
          <div>
            <dt>{tr('O\'qishni boshlagan')}</dt>
            <dd>{date(customer.paidAt)}</dd>
          </div>
        )}
        {customer.email && (
          <div>
            <dt>{tr('Email')}</dt>
            <dd>{customer.email}</dd>
          </div>
        )}
        {customer.note && (
          <div className="print-wide">
            <dt>{tr('Izoh')}</dt>
            <dd>{customer.note}</dd>
          </div>
        )}
      </dl>

      <div className="print-summary">
        <div>
          <span>{tr('Jami to\'lagan')}</span>
          <strong>{money(totalPaid)}</strong>
        </div>
        {debt && (
          <>
            <div>
              <span>{tr('Shu oygacha kutilgan')}</span>
              <strong>{money(debt.expected)}</strong>
            </div>
            <div>
              <span>{tr('Qarz')}</span>
              <strong>{debt.debt > 0 ? money(debt.debt) : tr('Yo\'q')}</strong>
            </div>
          </>
        )}
      </div>

      <h2>{tr('To\'lovlar tarixi')}</h2>
      {payments.length === 0 ? (
        <p>{tr('Hali to\'lov qayd etilmagan.')}</p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th>{tr('Sana')}</th>
              <th>{tr('Turi')}</th>
              <th>{tr('Izoh')}</th>
              <th>{tr('To\'lov turi')}</th>
              <th>{tr('Status')}</th>
              <th className="align-right">{tr('Summa')}</th>
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
        <span>{tr('Tayyorladi:')} {printedBy || '—'}</span>
        <span className="receipt-line" aria-hidden="true" />
      </footer>
    </article>
  )
}
