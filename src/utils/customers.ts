import type { Customer, CustomerFilters, CustomerInput, CustomerSortKey, CustomerStatus } from '../types/customer.types'
import type { SortState } from '../types/dashboard.types'
import type { Transaction } from '../types/finance.types'
import { FUNNEL_STAGES } from '../constants/navigation'
import { customPeriod, inPeriod } from './analytics'
import { applyDirection, compareText } from './list'
import { isValidPhone, phoneDigits } from './phone'

export const EMPTY_CUSTOMER_FILTERS: CustomerFilters = { status: 'all', course: 'all', source: 'all', from: '', to: '' }

// Holatlar voronka tartibida saralanadi, alifbo bo'yicha emas
const STATUS_ORDER: Record<CustomerStatus, number> = { new: 0, contacted: 1, thinking: 2, paid: 3, cancelled: 4 }

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
      inDateRange(c.createdAt, filters.from, filters.to) &&
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
  return filters.status !== 'all' || filters.course !== 'all' || filters.source !== 'all' || filters.from !== '' || filters.to !== ''
}

// Qo'shilgan sana oralig'i (mahalliy vaqt, chegaralar kiradi); bo'sh chegara — cheklanmagan
function inDateRange(iso: string, from: string, to: string): boolean {
  const period = customPeriod(from, to)
  return period === null || inPeriod(iso, period)
}

// Alt + strelka: kartani qo'shni bosqichga o'tkazish (chetda bo'lsa null)
export function neighbourStage(stage: CustomerStatus, step: -1 | 1, stages: readonly CustomerStatus[] = FUNNEL_STAGES): CustomerStatus | null {
  return stages[stages.indexOf(stage) + step] ?? null
}

// Kanban ustunlari: har bosqich uchun ro'yxat (tartib FUNNEL_STAGES bo'yicha)
export function groupByStage(customers: readonly Customer[], stages: readonly CustomerStatus[]): Record<CustomerStatus, Customer[]> {
  const groups = Object.fromEntries(stages.map((stage) => [stage, [] as Customer[]])) as Record<CustomerStatus, Customer[]>
  for (const customer of customers) groups[customer.status]?.push(customer)
  return groups
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

// Mijozga bog'liq to'lovlar: soni va jami kirim summasi
export function customerPayments(customerId: string, transactions: readonly Transaction[]): { count: number; total: number } {
  const own = transactions.filter((t) => t.customerId === customerId)
  return { count: own.length, total: own.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : 0), 0) }
}

// O'chirishni tasdiqlash matni — jadvalda ham, mijoz kartasida ham bir xil
export function deleteCustomerMessage(customer: Customer, transactions: readonly Transaction[], money: (amount: number) => string): string {
  const { count, total } = customerPayments(customer.id, transactions)
  const payments =
    count > 0
      ? `Unga bog'liq ${count} ta to'lov (jami ${money(total)}) jurnalda "${deletedCustomerName(customer.name)}" nomi bilan qoladi.`
      : 'Unga bog\'liq to\'lovlar yo\'q.'
  return `"${customer.name}" mijozi butunlay o'chiriladi. ${payments} Davom etasizmi?`
}

export function deletedCustomerName(name?: string): string {
  return `${name || 'Mijoz'} (o'chirilgan)`
}

// Mijoz bazada bo'lsa — joriy ismi; o'chirilgan bo'lsa — tranzaksiyadagi snapshot + "(o'chirilgan)"
export function resolveCustomerName(customerId: string | undefined, customer: Customer | undefined, snapshot: string | undefined): string {
  if (!customerId) return '—'
  if (customer) return customer.name
  return deletedCustomerName(snapshot)
}
