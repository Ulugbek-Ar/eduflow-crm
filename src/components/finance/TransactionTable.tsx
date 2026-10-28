import { useState } from 'react'
import { DATE_RANGE_LABELS, Icon, METHOD_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { TransactionType } from '../../types/finance.types'
import { formatDate, isInRange } from '../../utils/format'

type TypeFilter = TransactionType | 'all'

export function TransactionTable() {
  const { transactions, search, dateRange, money, getCustomerName, deleteTransaction, openModal } = useDashboard()
  const [type, setType] = useState<TypeFilter>('all')

  const inRange = transactions
    .filter((t) => isInRange(t.date, dateRange))
    .sort((a, b) => b.date.localeCompare(a.date))
  const income = inRange.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expense = inRange.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

  const query = search.trim().toLowerCase()
  const rows = inRange.filter((t) => {
    if (type !== 'all' && t.type !== type) return false
    if (!query) return true
    return t.note.toLowerCase().includes(query) || getCustomerName(t.customerId).toLowerCase().includes(query)
  })

  const handleDelete = (id: string) => {
    if (window.confirm('Ushbu tranzaksiyani o\'chirishni tasdiqlaysizmi?')) deleteTransaction(id)
  }

  return (
    <>
      <div className="summary-grid">
        <div className="card summary">
          <small>Kirim</small>
          <strong className="text-success">{money(income)}</strong>
        </div>
        <div className="card summary">
          <small>Chiqim</small>
          <strong className="text-danger">{money(expense)}</strong>
        </div>
        <div className="card summary">
          <small>Sof natija ({DATE_RANGE_LABELS[dateRange].toLowerCase()})</small>
          <strong className={income - expense < 0 ? 'text-danger' : undefined}>{money(income - expense)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Tranzaksiyalar jurnali</h2>
            <span className="muted">{rows.length} ta yozuv</span>
          </div>
          <div className="toolbar">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as TypeFilter)} aria-label="Turi bo'yicha filtr">
              <option value="all">Barchasi</option>
              <option value="income">{TYPE_LABELS.income}</option>
              <option value="expense">{TYPE_LABELS.expense}</option>
            </select>
            <button type="button" className="btn btn-primary" onClick={() => openModal('payment')}>
              <Icon name="plus" size={16} />
              <span>To'lov qo'shish</span>
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Turi</th>
                <th>Izoh</th>
                <th>Mijoz</th>
                <th>Usul</th>
                <th className="align-right">Summa</th>
                <th aria-label="Amallar" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{formatDate(t.date)}</td>
                  <td>
                    <span className={`badge badge-${t.type}`}>{TYPE_LABELS[t.type]}</span>
                  </td>
                  <td>{t.note || '—'}</td>
                  <td>{getCustomerName(t.customerId)}</td>
                  <td>{METHOD_LABELS[t.method]}</td>
                  <td className={`align-right nowrap strong ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                    {t.type === 'income' ? '+' : '−'}
                    {money(t.amount)}
                  </td>
                  <td className="cell-actions">
                    <button type="button" className="icon-btn danger" aria-label="O'chirish" onClick={() => handleDelete(t.id)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    Tanlangan davrda tranzaksiya topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
