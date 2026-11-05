import { useState } from 'react'
import { canOpenSection } from '../../auth/permissions'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { useQuickAdd } from '../../hooks/useQuickAdd'
import type { Section } from '../../types/dashboard.types'
import { cx } from '../../utils/cx'
import { Modal } from '../ui/Modal'

const ITEMS: Array<{ id: Section; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Asosiy', icon: 'overview' },
  { id: 'customers', label: 'Mijozlar', icon: 'customers' },
  { id: 'finance', label: 'Moliya', icon: 'dollar' },
]

// Telefonda pastki menyu: eng ko'p ishlatiladigan bo'limlar, "Qo'shish" va to'liq menyu — bosh barmoq yetadigan joyda
export function MobileNav() {
  const { activeSection, setActiveSection, toggleSidebar, sidebarOpen } = useDashboard()
  const { user } = useAuth()
  const actions = useQuickAdd()
  const [sheetOpen, setSheetOpen] = useState(false)
  const items = ITEMS.filter((item) => canOpenSection(user?.role, item.id))
  const [first, ...rest] = items

  const navButton = (item: (typeof ITEMS)[number]) => (
    <button
      key={item.id}
      type="button"
      className={cx('mobile-nav-item', activeSection === item.id && 'is-active')}
      aria-current={activeSection === item.id ? 'page' : undefined}
      onClick={() => setActiveSection(item.id)}
    >
      <Icon name={item.icon} size={20} />
      <span>{item.label}</span>
    </button>
  )

  return (
    <>
      <nav className="mobile-nav" aria-label="Pastki menyu">
        {first && navButton(first)}
        {rest[0] && navButton(rest[0])}
        {actions.length > 0 && (
          <button type="button" className="mobile-nav-item mobile-nav-add" aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
            <span className="mobile-nav-plus" aria-hidden="true">
              <Icon name="plus" size={22} />
            </span>
            <span>Qo'shish</span>
          </button>
        )}
        {rest.slice(1).map(navButton)}
        <button type="button" className="mobile-nav-item" aria-expanded={sidebarOpen} onClick={toggleSidebar}>
          <Icon name="menu" size={20} />
          <span>Menyu</span>
        </button>
      </nav>
      {sheetOpen && (
        <Modal title="Nima qo'shamiz?" onClose={() => setSheetOpen(false)} size="sm">
          <div className="quick-actions quick-sheet">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="quick-action"
                onClick={() => {
                  setSheetOpen(false)
                  action.run()
                }}
              >
                <span className="kpi-icon tone-primary">
                  <Icon name={action.icon} size={18} />
                </span>
                <span>
                  <strong>{action.label}</strong>
                  <small className="muted">{action.description}</small>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
