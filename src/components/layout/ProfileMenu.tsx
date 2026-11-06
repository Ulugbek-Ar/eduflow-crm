import { tr } from '../../i18n'
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
      label={tr('Profil menyusi')}
      className="header-profile"
      header={
        <div className="profile-menu-head">
          <strong>{name}</strong>
          <small>
            {user.title ? `${user.title} · ` : ''}
            {role}
          </small>
          <small className="muted">{tr('Login:')} {user.login}</small>
        </div>
      }
      trigger={(props) => (
        <button type="button" className="profile-btn" aria-label={tr('Profil: {0}', { 0: name })} {...props}>
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
          label: tr('Hisob'),
          items: [
            {
              id: 'profile',
              label: tr('Profil va parol'),
              description: tr('Ism, lavozim, login va parol'),
              icon: 'user',
              onSelect: () => {
                setActiveSection('settings')
                scrollToId('profile')
              },
            },
            {
              id: 'theme',
              label: resolved === 'dark' ? tr('Yorug\' mavzu') : tr('Qorong\'i mavzu'),
              icon: resolved === 'dark' ? 'sun' : 'moon',
              onSelect: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
            },
            {
              id: 'logout',
              label: mode === 'demo' ? tr('Demo\'dan chiqish') : tr('Chiqish'),
              icon: 'logout',
              onSelect: () => {
                logout()
                toast.info(mode === 'demo' ? tr('Demo yopildi — namunaviy ma\'lumot o\'chirildi') : tr('Tizimdan chiqdingiz'))
              },
            },
          ],
        },
      ]}
    />
  )
}
