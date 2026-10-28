import { Icon, NAV_ITEMS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'

export function Sidebar() {
  const { activeSection, setActiveSection, balance, money, settings, sidebarOpen, toggleSidebar } = useDashboard()

  return (
    <>
      <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="sidebar-logo">
          <span className="logo-mark">
            <Icon name="logo" size={20} />
          </span>
          <div>
            <strong>{settings.orgName}</strong>
            <small>Apex Dashboard</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${activeSection === item.id ? ' is-active' : ''}`}
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
          <span className="avatar">{settings.adminLogin.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{settings.adminLogin}</strong>
            <small>Administrator</small>
          </div>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={toggleSidebar} />}
    </>
  )
}
