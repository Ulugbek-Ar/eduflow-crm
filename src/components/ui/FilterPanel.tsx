import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'
import { Button } from './Button'

// Filtrlar: kompyuterda doim ochiq; telefonda "Filtrlar (2)" tugmasi ortida — ro'yxat ekranning tepasida ko'rinadi
export function FilterPanel({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <>
      <div className="filter-toggle-row">
        <Button variant="ghost" size="sm" icon="filter" className="filter-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          {activeCount > 0 ? `Filtrlar (${activeCount})` : 'Filtrlar'}
        </Button>
      </div>
      <div id={id} className={cx('filters', 'filter-panel', open && 'is-open')}>
        {children}
      </div>
    </>
  )
}
