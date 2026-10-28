import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey, CustomerStatus } from '../types/customer.types'
import type { SortState } from '../types/dashboard.types'
import { applyDirection, compareText } from './list'
import { isValidPhone, phoneDigits } from './phone'

export const EMPTY_CUSTOMER_FILTERS: CustomerFilters = { status: 'all', course: 'all', source: 'all' }

// Holatlar voronka tartibida saralanadi, alifbo bo'yicha emas
const STATUS_ORDER: Record<CustomerStatus, number> = { lead: 0, active: 1, paused: 2, left: 3 }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function matchesCustomer(customer: Customer, search: string): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true
  const digits = query.replace(/\D/g, '')
  return (
    customer.name.toLowerCase().includes(query) ||
    customer.course.toLowerCase().includes(query) ||
    (customer.email?.toLowerCase().includes(query) ?? false) ||
    (digits.length > 0 && customer.phone.replace(/\D/g, '').includes(digits))
  )
}

export function filterCustomers(customers: readonly Customer[], search: string, filters: CustomerFilters): Customer[] {
  return customers.filter(
    (c) =>
      (filters.status === 'all' || c.status === filters.status) &&
      (filters.course === 'all' || c.course === filters.course) &&
      (filters.source === 'all' || c.source === filters.source) &&
      matchesCustomer(c, search),
  )
}

export function sortCustomers(customers: readonly Customer[], sort: SortState<CustomerSortKey>): Customer[] {
  return [...customers].sort((a, b) => {
    let result: number
    switch (sort.key) {
      case 'name':
        result = compareText(a.name, b.name)
        break
      case 'course':
        result = compareText(a.course, b.course)
        break
      case 'status':
        result = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        break
      case 'createdAt':
        result = a.createdAt.localeCompare(b.createdAt)
        break
    }
    return applyDirection(result, sort.direction)
  })
}

export function hasActiveFilters(filters: CustomerFilters): boolean {
  return filters.status !== 'all' || filters.course !== 'all' || filters.source !== 'all'
}

export type CustomerFormErrors = Partial<Record<'name' | 'phone' | 'email', string>>

export function validateCustomer(input: CustomerInput, existing: readonly Customer[], editingId?: string): CustomerFormErrors {
  const errors: CustomerFormErrors = {}
  if (input.name.trim().length < 2) errors.name = 'Ismni kiriting (kamida 2 ta belgi)'

  if (!isValidPhone(input.phone)) {
    errors.phone = 'Telefon +998 XX XXX XX XX formatida bo\'lishi kerak'
  } else {
    const digits = phoneDigits(input.phone)
    const duplicate = existing.find((c) => c.id !== editingId && phoneDigits(c.phone) === digits)
    if (duplicate) errors.phone = `Bu raqam "${duplicate.name}" mijozida mavjud`
  }

  const email = input.email?.trim() ?? ''
  if (email && !EMAIL_PATTERN.test(email)) errors.email = 'Email noto\'g\'ri formatda'
  return errors
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
