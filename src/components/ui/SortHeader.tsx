import { Icon } from '../../constants/navigation'
import type { SortState } from '../../types/dashboard.types'
import { cx } from '../../utils/cx'

interface SortHeaderProps<K extends string> {
  label: string
  sortKey: K
  sort: SortState<K>
  onSort: (sort: SortState<K>) => void
  align?: 'left' | 'right'
}

export function SortHeader<K extends string>({ label, sortKey, sort, onSort, align = 'left' }: SortHeaderProps<K>) {
  const active = sort.key === sortKey
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'

  const handleClick = () => {
    onSort({ key: sortKey, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' })
  }

  return (
    <th scope="col" aria-sort={ariaSort} className={cx(align === 'right' && 'align-right')}>
      <button type="button" className={cx('sort-btn', active && 'is-active')} onClick={handleClick}>
        {label}
        <Icon name={active ? (sort.direction === 'asc' ? 'arrowUp' : 'arrowDown') : 'sort'} size={13} />
      </button>
    </th>
  )
}
