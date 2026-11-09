import { useDashboard } from '../../context/useDashboard'
import { tr } from '../../i18n'
import { Select } from '../ui/Select'

interface BranchSelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  // Bo'sh tanlov ("Umumiy" yoki "Barcha filiallar")
  noneLabel?: string
  error?: string
  hint?: string
  label?: string
}

// Filiallar bo'lmasa — hech narsa chiqmaydi. Filialga cheklangan xodimda — o'zgartirib bo'lmaydi
export function BranchSelect({ id, value, onChange, noneLabel, error, hint, label }: BranchSelectProps) {
  const { branches, restrictedBranch } = useDashboard()
  if (branches.length === 0) return null
  const options = branches
    .filter((b) => b.status === 'active' || b.id === value)
    .map((b) => ({ value: b.id, label: b.status === 'archived' ? tr('{0} (arxiv)', { 0: b.name }) : b.name }))
  return (
    <Select
      id={id}
      label={label ?? tr('Filial')}
      value={value}
      error={error}
      hint={hint}
      disabled={Boolean(restrictedBranch)}
      onChange={(e) => onChange(e.target.value)}
      options={noneLabel === undefined || restrictedBranch ? options : [{ value: '', label: noneLabel }, ...options]}
    />
  )
}
