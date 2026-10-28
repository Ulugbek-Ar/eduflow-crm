import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { useTheme } from '../../hooks/useTheme'
import type { ThemePreference } from '../../hooks/useTheme'
import { Dropdown } from '../ui/Dropdown'

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: IconName }> = [
  { value: 'light', label: 'Yorug\'', icon: 'sun' },
  { value: 'dark', label: 'Qorong\'i', icon: 'moon' },
  { value: 'system', label: 'Tizim bo\'yicha', icon: 'monitor' },
]

export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme()
  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2]

  return (
    <Dropdown
      label="Mavzu"
      trigger={(props) => (
        <button type="button" className="icon-btn header-icon-btn" aria-label={`Mavzu: ${current.label}`} title={`Mavzu: ${current.label}`} {...props}>
          <Icon name={preference === 'system' ? 'monitor' : resolved === 'dark' ? 'moon' : 'sun'} size={18} />
        </button>
      )}
      sections={[
        {
          label: 'Mavzu',
          items: OPTIONS.map((option) => ({
            id: option.value,
            label: option.label,
            icon: option.icon,
            checked: preference === option.value,
            onSelect: () => setPreference(option.value),
          })),
        },
      ]}
    />
  )
}
