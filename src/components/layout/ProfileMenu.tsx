import { ROLE_LABELS } from '../../auth/permissions'
import { Icon } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useToast } from '../../hooks/useToast'
import { displayName } from '../../services/users.service'
import { getInitials } from '../../utils/customers'
import { scrollToId } from '../../utils/scroll'
import { Dropdown } from '../ui/Dropdown'

export function ProfileMenu() {
  const { setActiveSection } = useDashboard()
  const { user, logout, mode } = useAuth()
  const toast = useToast()
  const { resolved, setPreference } = useTheme()
  if (!user) return null
  const name = displayName(user)
  const role = ROLE_LABELS[user.role]

  return (
    <Dropdown
      label="Profil menyusi"
      className="header-profile"
      header={
        <div className="profile-menu-head">
          <strong>{name}</strong>
          <small>
            {user.title ? `${user.title} · ` : ''}
            {role}
          </small>
          <small className="muted">Login: {user.login}</small>
        </div>
      }
      trigger={(props) => (
        <button type="button" className="profile-btn" aria-label={`Profil: ${name}`} {...props}>
          <span className="avatar avatar-sm" aria-hidden="true">
            {getInitials(name)}
          </span>
          <span className="profile-btn-text hide-mobile">
            <strong>{name}</strong>
            <small>{role}</small>
          </span>
          <Icon name="chevronDown" size={14} />
        </button>
      )}
      sections={[
        {
          label: 'Hisob',
          items: [
            {
              id: 'profile',
              label: 'Profil va parol',
              description: 'Ism, lavozim, login va parol',
              icon: 'user',
              onSelect: () => {
                setActiveSection('settings')
                scrollToId('profile')
              },
            },
            {
              id: 'theme',
              label: resolved === 'dark' ? 'Yorug\' mavzu' : 'Qorong\'i mavzu',
              icon: resolved === 'dark' ? 'sun' : 'moon',
              onSelect: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
            },
            {
              id: 'logout',
              label: mode === 'demo' ? 'Demo\'dan chiqish' : 'Chiqish',
              icon: 'logout',
              onSelect: () => {
                logout()
                toast.info(mode === 'demo' ? 'Demo yopildi — namunaviy ma\'lumot o\'chirildi' : 'Tizimdan chiqdingiz')
              },
            },
          ],
        },
      ]}
    />
  )
}
