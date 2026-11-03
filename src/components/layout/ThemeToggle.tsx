import { Icon } from '../../constants/navigation'
import { useTheme } from '../../hooks/useTheme'

// Bitta tugma: yorug' <-> qorong'i. "Tizim bo'yicha" Sozlamalar → Mintaqa va ko'rinish'da tanlanadi
export function ThemeToggle() {
  const { resolved, setPreference } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  const label = next === 'dark' ? 'Qorong\'i mavzuga o\'tish' : 'Yorug\' mavzuga o\'tish'

  return (
    <button type="button" className="icon-btn header-icon-btn" aria-label={label} title={label} onClick={() => setPreference(next)}>
      <Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  )
}
