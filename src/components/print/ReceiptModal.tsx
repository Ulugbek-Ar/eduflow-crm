import { tr } from '../../i18n'
import { useState, useSyncExternalStore } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { usePersistentState } from '../../hooks/usePersistentState'
import { getAuditSnapshot, subscribeAudit } from '../../services/audit.service'
import { cx } from '../../utils/cx'
import { buildReceipt, isPaperSize } from '../../utils/receipt'
import type { PaperSize } from '../../utils/receipt'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { PrintDocument } from './PrintDocument'
import { Receipt } from './Receipt'

const SIZES: Array<{ id: PaperSize; label: string }> = [
  { id: 'thermal', label: tr('80 mm (chek printeri)') },
  { id: 'a4', label: tr('A4') },
]

export function ReceiptModal({ transactionId }: { transactionId: string }) {
  const { getTransaction, customers, courses, transactions, settings, money, getCustomerName, closeModal, debtContext } = useDashboard()
  const audit = useSyncExternalStore(subscribeAudit, getAuditSnapshot)
  const [size, setSize] = usePersistentState<PaperSize>('apex:receipt-size', 'thermal', isPaperSize)
  const [printing, setPrinting] = useState(false)
  const transaction = getTransaction(transactionId)

  if (!transaction) {
    return (
      <Modal title={tr('To\'lov cheki')} onClose={closeModal} size="sm">
        <p className="muted">{tr('Tranzaksiya topilmadi — o\'chirilgan bo\'lishi mumkin.')}</p>
      </Modal>
    )
  }

  const data = buildReceipt(transaction, customers, courses, transactions, audit, transaction.customerId ? getCustomerName(transaction.customerId) : transaction.note, debtContext)

  return (
    <Modal
      title={tr('To\'lov cheki')}
      onClose={closeModal}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            {tr('Yopish')}
          </Button>
          <Button icon="fileText" onClick={() => setPrinting(true)} data-autofocus>
            {tr('Chop etish')}
          </Button>
        </>
      }
    >
      <div className="segmented segmented-full receipt-size" role="group" aria-label={tr('Qog\'oz o\'lchami')}>
        {SIZES.map((s) => (
          <button key={s.id} type="button" aria-pressed={size === s.id} className={cx(size === s.id && 'is-active')} onClick={() => setSize(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className={cx('receipt-preview', `print-${size}`)}>
        <Receipt data={data} settings={settings} money={money} />
      </div>
      {printing && (
        <PrintDocument size={size} onDone={() => setPrinting(false)}>
          <Receipt data={data} settings={settings} money={money} />
        </PrintDocument>
      )}
    </Modal>
  )
}
