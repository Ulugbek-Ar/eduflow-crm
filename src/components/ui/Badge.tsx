import type { ReactNode } from 'react'
import type { CustomerStatus } from '../../types/customer.types'
import { cx } from '../../utils/cx'

export type BadgeTone = CustomerStatus | 'income' | 'expense' | 'neutral' | 'primary' | 'warning'

export function Badge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cx('badge', `badge-${tone}`, className)}>{children}</span>
}
