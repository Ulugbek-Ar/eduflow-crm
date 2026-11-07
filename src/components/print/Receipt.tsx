import { tr } from '../../i18n'
import { METHOD_LABELS } from '../../constants/navigation'
import type { Settings } from '../../types/dashboard.types'
import type { Transaction } from '../../types/finance.types'
import { amountInWords } from '../../utils/amountWords'
import { formatDateTimeWith } from '../../utils/format'
import { receiptNumber } from '../../utils/receipt'
import type { ReceiptData } from '../../utils/receipt'

const TITLES: Record<Transaction['status'], string> = {
  paid: tr('To\'lov cheki'),
  pending: tr('To\'lov uchun hisob'),
  cancelled: tr('Bekor qilingan to\'lov'),
}

export function Receipt({ data, settings, money }: { data: ReceiptData; settings: Settings; money: (amount: number) => string }) {
  const { transaction: t, customer } = data
  return (
    <article className="receipt" aria-label={tr('Chek')}>
      <header className="receipt-head">
        {settings.logoImage ? (
          <img src={settings.logoImage} alt="" className="receipt-logo" />
        ) : (
          settings.logoText && <span className="receipt-mark">{settings.logoText}</span>
        )}
        <strong className="receipt-org">{settings.orgName}</strong>
        {settings.address && <span>{settings.address}</span>}
        {settings.phone && <span>{tr('Tel:')} {settings.phone}</span>}
      </header>

      <div className="receipt-title">
        <strong>{TITLES[t.status]}</strong>
        <span>№ {receiptNumber(t)}</span>
        <span>{formatDateTimeWith(t.date, settings.dateFormat)}</span>
      </div>

      <dl className="receipt-rows">
        <div>
          <dt>{tr('To\'lovchi')}</dt>
          <dd>{data.customerName || '—'}</dd>
        </div>
        {customer?.phone && (
          <div>
            <dt>{tr('Telefon')}</dt>
            <dd>{customer.phone}</dd>
          </div>
        )}
        {customer?.course && (
          <div>
            <dt>{tr('Kurs')}</dt>
            <dd>{customer.course}</dd>
          </div>
        )}
        {data.groupName && (
          <div>
            <dt>{tr('Guruh')}</dt>
            <dd>{data.groupName}</dd>
          </div>
        )}
        {data.periodLabel && (
          <div>
            <dt>{tr('Oy')}</dt>
            <dd>{data.periodLabel}</dd>
          </div>
        )}
        <div>
          <dt>{tr('To\'lov turi')}</dt>
          <dd>{METHOD_LABELS[t.method]}</dd>
        </div>
        {t.note && (
          <div>
            <dt>{tr('Izoh')}</dt>
            <dd>{t.note}</dd>
          </div>
        )}
      </dl>

      <div className="receipt-total">
        <span>{tr('Jami')}</span>
        <strong>{money(t.amount)}</strong>
      </div>
      <p className="receipt-words">{amountInWords(t.amount, settings.currency)}</p>
      {t.status === 'paid' && data.remainingDebt > 0 && <p className="receipt-debt">{tr('Qolgan qarz:')} {money(data.remainingDebt)}</p>}
      {t.status === 'cancelled' && <p className="receipt-stamp">{tr('BEKOR QILINGAN')}</p>}

      <footer className="receipt-foot">
        <div className="receipt-sign">
          <span>{tr('Qabul qildi:')} {data.cashier || '—'}</span>
          <span className="receipt-line" aria-hidden="true" />
        </div>
        <div className="receipt-sign">
          <span>{tr('To\'lovchi imzosi')}</span>
          <span className="receipt-line" aria-hidden="true" />
        </div>
        <p className="receipt-thanks">{tr('Rahmat! Bilim — eng yaxshi sarmoya.')}</p>
      </footer>
    </article>
  )
}
