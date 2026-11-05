import { ROLE_LABELS, ROLES } from '../../auth/permissions'
import { useAuth } from '../../hooks/useAuth'
import type { Role } from '../../types/user.types'
import { Button } from '../ui/Button'

// Demo rejim tasmasi: bu namunaviy markaz ekanini eslatadi, rollarni sinab ko'rish va chiqish
export function DemoBar() {
  const { mode, user, switchDemoRole, exitDemo } = useAuth()
  if (mode !== 'demo' || !user) return null
  return (
    <div className="demo-bar" role="region" aria-label="Demo rejim">
      <p>
        <strong>Demo rejim</strong>
        <span className="hide-mobile"> — bu namunaviy markaz, o'zgarishlar sizning ma'lumotingizga ta'sir qilmaydi.</span>
      </p>
      <label className="demo-role">
        <span className="hide-mobile">Rol sifatida ko'rish:</span>
        <span className="show-mobile">Rol:</span>
        <select className="input input-sm" value={user.role} onChange={(e) => switchDemoRole(e.target.value as Role)}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      <Button variant="ghost" size="sm" icon="logout" onClick={exitDemo} aria-label="Demo'dan chiqish">
        <span className="hide-mobile">Demo'dan chiqish</span>
        <span className="show-mobile">Chiqish</span>
      </Button>
    </div>
  )
}
