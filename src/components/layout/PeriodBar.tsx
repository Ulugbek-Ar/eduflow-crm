import { tr } from '../../i18n'
import { DATE_RANGE_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import type { DateRange, Section } from '../../types/dashboard.types'

const RANGES = Object.keys(DATE_RANGE_LABELS) as DateRange[]
// Davr (bugun / 7 kun / oy / yil) faqat shu bo'limlardagi raqamlarga ta'sir qiladi — boshqa joyda ko'rsatilmaydi
const PERIOD_SECTIONS: readonly Section[] = ['overview', 'finance', 'analytics']

// Sahifa tepasida, raqamlar yonida: qaysi davr ko'rsatilayotgani darhol ko'rinadi
export function PeriodBar() {
  const { activeSection, dateRange, setDateRange } = useDashboard()
  const { user } = useAuth()
  // QA-09: o'qituvchining "Bugun" sahifasi davrga bog'liq emas
  if (!PERIOD_SECTIONS.includes(activeSection) || user?.role === 'teacher') return null
  return (
    <div className="period-bar">
      <span className="muted">{tr('Davr:')}</span>
      <div className="segmented header-period" role="group" aria-label={tr('Davr')}>
        {RANGES.map((range) => (
          <button key={range} type="button" aria-pressed={dateRange === range} className={dateRange === range ? 'is-active' : undefined} onClick={() => setDateRange(range)}>
            {DATE_RANGE_LABELS[range]}
          </button>
        ))}
      </div>
    </div>
  )
}
