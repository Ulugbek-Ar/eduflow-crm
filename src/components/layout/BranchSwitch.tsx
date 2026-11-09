import { Icon } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { tr } from '../../i18n'

// Header: qaysi filial ma'lumoti ko'rinayotgani. Filiallar bo'lmasa — hech narsa; filialga cheklangan xodimda — faqat nomi
export function BranchSwitch() {
  const { branches, branchFilter, setBranchFilter, restrictedBranch, getBranch } = useDashboard()
  if (branches.length === 0) return null
  if (restrictedBranch) {
    return (
      <span className="branch-switch is-fixed" title={tr('Siz shu filialga biriktirilgansiz')}>
        <Icon name="building" size={14} />
        <span className="branch-switch-name">{getBranch(restrictedBranch)?.name ?? tr('Filial')}</span>
      </span>
    )
  }
  const options = branches.filter((b) => b.status === 'active' || b.id === branchFilter)
  return (
    <label className="branch-switch">
      <Icon name="building" size={14} />
      <span className="sr-only">{tr('Filial')}</span>
      <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label={tr('Filial')}>
        <option value="">{tr('Barcha filiallar')}</option>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  )
}
