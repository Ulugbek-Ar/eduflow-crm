import { Icon } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getInitials } from '../../utils/customers'
import { scrollToId } from '../../utils/scroll'
import { Dropdown } from '../ui/Dropdown'

export function ProfileMenu() {
  const { settings, setActiveSection } = useDashboard()
  const { session, logout } = useAuth()
  const toast = useToast()
  const login = session?.login ?? settings.adminLogin
  const name = settings.profileName || login
  const role = settings.profileRole || 'Administrator'

  return (
    <Dropdown
      label="Profil menyusi"
      header={
        <div className="profile-menu-head">
          <strong>{name}</strong>
          <small>
            {role} · {login}
          </small>
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
              label: 'Profil',
              description: 'Ism, lavozim, login va parol',
              icon: 'user',
              onSelect: () => {
                setActiveSection('settings')
                scrollToId('profile')
              },
            },
            {
              id: 'logout',
              label: 'Chiqish',
              icon: 'logout',
              onSelect: () => {
                logout()
                toast.info('Tizimdan chiqdingiz')
              },
            },
          ],
        },
      ]}
    />
  )
}
