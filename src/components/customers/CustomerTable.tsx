import { useState } from 'react'
import { Icon, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { CustomerStatus } from '../../types/customer.types'
import { formatDate } from '../../utils/format'

type StatusFilter = CustomerStatus | 'all'

const STATUSES = Object.keys(STATUS_LABELS) as CustomerStatus[]

export function CustomerTable() {
  const { customers, search, deleteCustomer, openModal } = useDashboard()
  const [status, setStatus] = useState<StatusFilter>('all')

  const query = search.trim().toLowerCase()
  const digits = query.replace(/\D/g, '')
  const rows = customers.filter((c) => {
    if (status !== 'all' && c.status !== status) return false
    if (!query) return true
    return (
      c.name.toLowerCase().includes(query) ||
      c.course.toLowerCase().includes(query) ||
      (digits.length > 0 && c.phone.replace(/\D/g, '').includes(digits))
    )
  })

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`"${name}" mijozini o'chirishni tasdiqlaysizmi?`)) deleteCustomer(id)
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Mijozlar bazasi</h2>
          <span className="muted">
            {rows.length} ta natija (jami {customers.length})
          </span>
        </div>
        <div className="toolbar">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Holat bo'yicha filtr">
            <option value="all">Barcha holatlar</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => openModal('customer')}>
            <Icon name="plus" size={16} />
            <span>Yangi mijoz</span>
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Ism</th>
              <th>Telefon</th>
              <th>Kurs</th>
              <th>Holat</th>
              <th>Manba</th>
              <th>Qo'shilgan</th>
              <th aria-label="Amallar" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="strong">{c.name}</td>
                <td className="nowrap">{c.phone}</td>
                <td>{c.course}</td>
                <td>
                  <span className={`badge badge-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                </td>
                <td>{SOURCE_LABELS[c.source]}</td>
                <td className="nowrap">{formatDate(c.createdAt)}</td>
                <td className="cell-actions">
                  <button type="button" className="icon-btn danger" aria-label="O'chirish" onClick={() => handleDelete(c.id, c.name)}>
                    <Icon name="trash" size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  Mos keladigan mijoz topilmadi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
