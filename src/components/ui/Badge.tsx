import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'

export type BadgeTone = 'lead' | 'active' | 'paused' | 'left' | 'income' | 'expense' | 'neutral' | 'primary'

export function Badge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cx('badge', `badge-${tone}`, className)}>{children}</span>
}
