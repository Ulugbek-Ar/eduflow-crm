import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useNotifications } from '../../hooks/useNotifications'
import { cx } from '../../utils/cx'
import { buildNotifications } from '../../utils/notifications'

export function NotificationBell() {
  const { customers, transactions, balance, money, setActiveSection, setCustomerFilters, customerFilters } = useDashboard()
  const { items, unread, markRead, markAllRead, clearAll } = useNotifications(buildNotifications(customers, transactions, balance, money))
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const label = unread > 0 ? `Bildirishnomalar: ${unread} ta o'qilmagan` : 'Bildirishnomalar'

  return (
    <div
      className="dropdown"
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
          rootRef.current?.querySelector<HTMLElement>('.bell-btn')?.focus()
        }
      }}
    >
      <button
        type="button"
        className="icon-btn header-icon-btn bell-btn"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="bell-count" aria-hidden="true">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} className="dropdown-menu notification-panel" role="region" aria-label="Bildirishnomalar">
          <div className="notification-head">
            <strong>Bildirishnomalar</strong>
            {items.length > 0 && (
              <div className="notification-tools">
                <button type="button" className="text-btn" onClick={markAllRead} disabled={unread === 0}>
                  Hammasi o'qildi
                </button>
                <button type="button" className="text-btn" onClick={clearAll}>
                  Tozalash
                </button>
              </div>
            )}
          </div>
          {items.length === 0 ? (
            <p className="notification-empty muted">Hozircha eslatma yo'q — hammasi joyida.</p>
          ) : (
            <ul className="notification-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cx('notification-item', !n.read && 'is-unread')}
                    onClick={() => {
                      markRead(n.id)
                      setOpen(false)
                      if (n.id.startsWith('stale-leads')) setCustomerFilters({ ...customerFilters, status: 'lead' })
                      setActiveSection(n.target)
                    }}
                  >
                    <span className={cx('notification-icon', `tone-${n.tone}`)}>
                      <Icon name={n.tone === 'warning' ? 'clock' : 'alert'} size={16} />
                    </span>
                    <span className="notification-text">
                      <strong>{n.title}</strong>
                      <small>{n.description}</small>
                    </span>
                    {!n.read && <span className="unread-dot" aria-label="O'qilmagan" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
