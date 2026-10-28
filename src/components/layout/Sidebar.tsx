import { Icon, NAV_ITEMS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { cx } from '../../utils/cx'
import { IconButton } from '../ui/Button'

export function Sidebar() {
  const { activeSection, setActiveSection, balance, money, settings, sidebarOpen, toggleSidebar } = useDashboard()
  const { session, logout } = useAuth()
  const toast = useToast()
  const login = session?.login ?? settings.adminLogin

  return (
    <>
      <aside className={cx('sidebar', sidebarOpen && 'is-open')} aria-label="Asosiy menyu">
        <div className="sidebar-logo">
          <span className="logo-mark" aria-hidden="true">
            {settings.logoText ? <span className="logo-text">{settings.logoText}</span> : <Icon name="logo" size={20} />}
          </span>
          <div>
            <strong>{settings.orgName}</strong>
            <small>Apex Dashboard</small>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Bo'limlar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx('nav-item', activeSection === item.id && 'is-active')}
              aria-current={activeSection === item.id ? 'page' : undefined}
              onClick={() => setActiveSection(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-balance">
          <small>Kassa balansi</small>
          <strong className={balance < 0 ? 'text-danger' : undefined}>{money(balance)}</strong>
        </div>

        <div className="sidebar-profile">
          <span className="avatar" aria-hidden="true">
            {login.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{login}</strong>
            <small>Administrator</small>
          </div>
          <IconButton
            icon="logout"
            label="Chiqish"
            className="logout-btn"
            onClick={() => {
              logout()
              toast.info('Tizimdan chiqdingiz')
            }}
          />
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={toggleSidebar} aria-hidden="true" />}
    </>
  )
}
