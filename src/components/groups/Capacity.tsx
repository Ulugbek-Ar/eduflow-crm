import { tr } from '../../i18n'
import { cx } from '../../utils/cx'

// Sig'im chizig'i: 12/15 (to'lishiga yaqin — sariq, to'lgan — qizil)
export function Capacity({ taken, capacity }: { taken: number; capacity: number }) {
  const ratio = capacity > 0 ? taken / capacity : 0
  return (
    <span className={cx('capacity', ratio >= 1 ? 'is-full' : ratio >= 0.85 && 'is-near')}>
      <span
        className="capacity-bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={taken}
        aria-label={tr('Sig\'im: {0} / {1}', { 0: taken, 1: capacity })}
      >
        <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </span>
      <span className="capacity-label">
        {taken}/{capacity}
      </span>
    </span>
  )
}
