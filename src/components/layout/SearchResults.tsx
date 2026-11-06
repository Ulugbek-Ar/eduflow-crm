import { tr } from '../../i18n'
import type { KeyboardEvent } from 'react'
import { Icon, STATUS_LABELS, TYPE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { COURSE_TYPE_LABELS } from '../../utils/courses'
import type { SearchResults as Results } from '../../utils/search'

interface SearchResultsProps {
  id: string
  results: Results
  onClose: (focusInput: boolean) => void
}

// Strelkalar bilan natijalar orasida harakatlanish (input'dan ArrowDown bilan kiriladi)
function moveFocus(container: HTMLElement | null, step: 1 | -1) {
  const items = Array.from(container?.querySelectorAll<HTMLElement>('.search-result') ?? [])
  const index = items.indexOf(document.activeElement as HTMLElement)
  items[(index + step + items.length) % items.length]?.focus()
}

export function SearchResults({ id, results, onClose }: SearchResultsProps) {
  const { openModal, setActiveSection, money, formatDate, getCustomerName } = useDashboard()
  const can = useCan()

  const choose = (action: () => void) => {
    action()
    onClose(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose(true)
    }
  }

  return (
    <div id={id} className="search-results" role="region" aria-label={tr('Qidiruv natijalari')} onKeyDown={handleKeyDown}>
      {results.total === 0 ? (
        <p className="search-empty muted">{tr('Hech narsa topilmadi')}</p>
      ) : (
        <>
          {results.customers.length > 0 && (
            <div className="search-group">
              <span className="dropdown-heading">{tr('Mijozlar')}</span>
              {results.customers.map((c) => (
                <button key={c.id} type="button" className="search-result" onClick={() => choose(() => openModal({ type: 'customerDetail', payload: { id: c.id } }))}>
                  <Icon name="user" size={16} />
                  <span>
                    {c.name}
                    <small>
                      {c.phone} · {STATUS_LABELS[c.status]}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {results.courses.length > 0 && (
            <div className="search-group">
              <span className="dropdown-heading">{tr('Kurslar va xizmatlar')}</span>
              {results.courses.map((c) => (
                <button key={c.id} type="button" className="search-result" onClick={() => choose(() => (can('courses.edit') ? openModal({ type: 'course', payload: { id: c.id } }) : setActiveSection('courses')))}>
                  <Icon name="bookOpen" size={16} />
                  <span>
                    {c.name}
                    <small>
                      {COURSE_TYPE_LABELS[c.type]} · {money(c.monthlyPrice)} {tr('/ oy')}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {results.transactions.length > 0 && (
            <div className="search-group">
              <span className="dropdown-heading">{tr('Tranzaksiyalar')}</span>
              {results.transactions.map((t) => (
                <button key={t.id} type="button" className="search-result" onClick={() => choose(() => (can('payments.manage') ? openModal({ type: 'transaction', payload: { id: t.id } }) : setActiveSection('finance')))}>
                  <Icon name={t.type === 'income' ? 'card' : 'receipt'} size={16} />
                  <span>
                    {t.note || TYPE_LABELS[t.type]}
                    <small>
                      {t.customerId ? `${getCustomerName(t.customerId)} · ` : ''}
                      {formatDate(t.date)} · {money(t.amount)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="search-result search-all" onClick={() => choose(() => setActiveSection('customers'))}>
            <Icon name="search" size={16} />
            <span>{tr('Mijozlar bo\'limida qidirish')}</span>
          </button>
        </>
      )}
    </div>
  )
}
