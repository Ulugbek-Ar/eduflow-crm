import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import type { Permission } from '../../auth/permissions'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'

interface Action {
  label: string
  description: string
  icon: IconName
  onClick: () => void
  permission: Permission
}

export function QuickActions() {
  const { openModal, setActiveSection } = useDashboard()
  const can = useCan()

  const all: Action[] = [
    { label: 'Yangi lid', description: 'Mijoz "Yangi" bosqichiga qo\'shiladi', icon: 'userPlus', onClick: () => openModal({ type: 'customer' }), permission: 'customers.edit' },
    {
      label: 'To\'lov qabul qilish',
      description: 'Kurs to\'lovi yoki boshqa kirim',
      icon: 'card',
      onClick: () => openModal({ type: 'transaction', payload: { kind: 'income' } }),
      permission: 'payments.create',
    },
    {
      label: 'Xarajat yozish',
      description: 'Ijara, maosh, reklama va boshqalar',
      icon: 'receipt',
      onClick: () => openModal({ type: 'transaction', payload: { kind: 'expense' } }),
      permission: 'payments.manage',
    },
    { label: 'Qarzdorlar', description: 'Moliya va kassa · joriy oy', icon: 'dollar', onClick: () => setActiveSection('finance'), permission: 'payments.view' },
  ]
  const actions = all.filter((action) => can(action.permission))

  if (actions.length === 0) return null

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
