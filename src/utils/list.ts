import type { SortDirection } from '../types/dashboard.types'

export const PAGE_SIZES = [10, 20, 50] as const

export interface Page<T> {
  items: T[]
  page: number
  pageCount: number
  from: number
  to: number
  total: number
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  const slice = items.slice(start, start + pageSize)
  return {
    items: slice,
    page: current,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
    total,
  }
}

const collator = new Intl.Collator('uz', { sensitivity: 'base', numeric: true })

export function compareText(a: string, b: string): number {
  return collator.compare(a, b)
}

export function applyDirection(result: number, direction: SortDirection): number {
  return direction === 'asc' ? result : -result
}
