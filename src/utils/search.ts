import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { matchesCustomer } from './customers'

export interface SearchResults {
  customers: Customer[]
  courses: Course[]
  transactions: Transaction[]
  // Cheklovdan oldingi umumiy soni
  total: number
}

export const SEARCH_LIMITS = { customers: 5, courses: 3, transactions: 3 } as const

// Header'dagi global qidiruv (ro'yxat bo'lmagan bo'limlarda natijalar oynasi uchun)
export function globalSearch(
  query: string,
  customers: readonly Customer[],
  courses: readonly Course[],
  transactions: readonly Transaction[],
  getCustomerName: (id?: string) => string,
): SearchResults {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return { customers: [], courses: [], transactions: [], total: 0 }
  const foundCustomers = customers.filter((c) => matchesCustomer(c, needle))
  const foundCourses = courses.filter((c) => c.name.toLowerCase().includes(needle))
  const foundTransactions = transactions
    .filter((t) => t.note.toLowerCase().includes(needle) || (t.customerId !== undefined && getCustomerName(t.customerId).toLowerCase().includes(needle)))
    .sort((a, b) => b.date.localeCompare(a.date))
  return {
    customers: foundCustomers.slice(0, SEARCH_LIMITS.customers),
    courses: foundCourses.slice(0, SEARCH_LIMITS.courses),
    transactions: foundTransactions.slice(0, SEARCH_LIMITS.transactions),
    total: foundCustomers.length + foundCourses.length + foundTransactions.length,
  }
}
