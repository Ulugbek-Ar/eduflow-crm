import { PAGE_SIZES } from '../../utils/list'
import { IconButton } from './Button'

interface PaginationProps {
  page: number
  pageCount: number
  pageSize: number
  from: number
  to: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function Pagination({ page, pageCount, pageSize, from, to, total, onPageChange, onPageSizeChange }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Sahifalash">
      <label className="pagination-size">
        <span>Sahifada</span>
        <select className="input input-sm" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span className="pagination-info" aria-live="polite">
        {from}–{to} / {total}
      </span>
      <div className="pagination-buttons">
        <IconButton icon="chevronLeft" label="Oldingi sahifa" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
        <span className="pagination-page">
          {page} / {pageCount}
        </span>
        <IconButton icon="chevronRight" label="Keyingi sahifa" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} />
      </div>
    </nav>
  )
}
