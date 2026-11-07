import { tr } from '../../i18n'
import { useEffect, useRef } from 'react'
import { APP_NAME } from '../../constants/app'
import { Icon, NAV_ITEMS } from '../../constants/navigation'
import { canOpenSection } from '../../auth/permissions'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { cx } from '../../utils/cx'
import { Hint } from '../ui/Hint'

export function Sidebar() {
  const { activeSection, setActiveSection, balance, money, settings, sidebarOpen, toggleSidebar, sidebarCollapsed, toggleSidebarCollapsed } =
    useDashboard()
  const navRef = useRef<HTMLElement>(null)
  const { user, can } = useAuth()
  const items = NAV_ITEMS.filter((item) => canOpenSection(user?.role, item.id))

  // Mobil menyu ochilganda fokus birinchi bo'limga o'tadi, Esc yopadi
  useEffect(() => {
    if (!sidebarOpen) return
    navRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleSidebar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen, toggleSidebar])

  return (
    <>
      <aside className={cx('sidebar', sidebarOpen && 'is-open', sidebarCollapsed && 'is-collapsed')} aria-label={tr('Asosiy menyu')}>
        <div className="sidebar-logo">
          <span className="logo-mark" aria-hidden="true">
            {settings.logoImage ? (
              <img src={settings.logoImage} alt="" className="logo-image" />
            ) : settings.logoText ? (
              <span className="logo-text">{settings.logoText}</span>
            ) : (
              <Icon name="logo" size={20} />
            )}
          </span>
          <div className="sidebar-logo-text">
            <strong>{settings.orgName}</strong>
            <small>{APP_NAME}</small>
          </div>
        </div>

        <nav ref={navRef} className="sidebar-nav" aria-label={tr('Bo\'limlar')}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx('nav-item', activeSection === item.id && 'is-active')}
              aria-current={activeSection === item.id ? 'page' : undefined}
              data-tooltip={item.label}
              data-tour={item.id}
              onClick={() => setActiveSection(item.id)}
            >
              <Icon name={item.icon} />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {can('payments.view') && (
          <div className="sidebar-balance">
            <small>
              {tr('Kassa balansi')} <Hint term="balance" className="hint-on-dark" />
            </small>
            <strong className={balance < 0 ? 'text-danger' : undefined}>{money(balance)}</strong>
          </div>
        )}

        {/* Ixcham holat faqat planshet va kompyuterda; mobilda menyu chiqib keladigan panel */}
        <button
          type="button"
          className="nav-item sidebar-collapse"
          aria-pressed={sidebarCollapsed}
          data-tooltip={sidebarCollapsed ? tr('Menyuni kengaytirish') : tr('Menyuni yig\'ish')}
          onClick={toggleSidebarCollapsed}
        >
          <Icon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} />
          <span className="nav-label">{sidebarCollapsed ? tr('Menyuni kengaytirish') : tr('Menyuni yig\'ish')}</span>
        </button>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={toggleSidebar} aria-hidden="true" />}
    </>
  )
}
