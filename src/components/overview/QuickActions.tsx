import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'

interface Action {
  label: string
  description: string
  icon: IconName
  onClick: () => void
}

export function QuickActions() {
  const { openModal, setActiveSection } = useDashboard()

  const actions: Action[] = [
    { label: 'Yangi mijoz', description: 'Lead yoki o\'quvchi qo\'shish', icon: 'userPlus', onClick: () => openModal('customer') },
    { label: 'To\'lov qo\'shish', description: 'Kirim yoki chiqimni qayd etish', icon: 'card', onClick: () => openModal('payment') },
    { label: 'Mijozlar ro\'yxati', description: 'Barcha mijozlarni ko\'rish', icon: 'customers', onClick: () => setActiveSection('customers') },
    { label: 'Moliya jurnali', description: 'Tranzaksiyalar tarixi', icon: 'finance', onClick: () => setActiveSection('finance') },
  ]

  return (
    <div className="card">
      <div className="card-head">
        <h2>Tezkor amallar</h2>
      </div>
      <div className="quick-actions">
        {actions.map((action) => (
          <button key={action.label} type="button" className="quick-action" onClick={action.onClick}>
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
    </div>
  )
}
