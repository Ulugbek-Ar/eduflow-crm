import { tr } from '../../i18n'
import { ROLE_LABELS, ROLES } from '../../auth/permissions'
import { useAuth } from '../../hooks/useAuth'
import type { Role } from '../../types/user.types'
import { Button } from '../ui/Button'

// Demo rejim tasmasi (ixcham): kichik "Demo" belgisi, rollarni sinab ko'rish va chiqish — uzun izohsiz
export function DemoBar() {
  const { mode, user, switchDemoRole, exitDemo } = useAuth()
  if (mode !== 'demo' || !user) return null
  return (
    <div className="demo-bar" role="region" aria-label={tr('Demo rejim')}>
      <span className="demo-tag">{tr('Demo')}</span>
      <label className="demo-role">
        <span className="hide-mobile">{tr('Rol sifatida ko\'rish:')}</span>
        <span className="show-mobile">{tr('Rol:')}</span>
        <select className="input input-sm" value={user.role} onChange={(e) => switchDemoRole(e.target.value as Role)}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      <Button variant="ghost" size="sm" icon="logout" onClick={exitDemo} aria-label={tr('Demo\'dan chiqish')}>
        <span className="hide-mobile">{tr('Demo\'dan chiqish')}</span>
        <span className="show-mobile">{tr('Chiqish')}</span>
      </Button>
    </div>
  )
}
