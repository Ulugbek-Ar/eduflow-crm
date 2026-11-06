// Ilova modellari <-> Supabase qatorlari (snake_case). Bo'sh ixtiyoriy maydonlar null bo'ladi
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'

export type Row = Record<string, unknown>

const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v)

export function customerToRow(c: Customer, org: string): Row {
  return {
    organization_id: org,
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    course: c.course,
    status: c.status,
    source: c.source,
    note: c.note ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt ?? null,
    paid_at: c.paidAt ?? null,
  }
}

export function rowToCustomer(r: Row): Customer {
  const c: Customer = {
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone ?? ''),
    course: String(r.course ?? ''),
    status: r.status as Customer['status'],
    source: r.source as Customer['source'],
    createdAt: String(r.created_at),
  }
  if (opt(r.email)) c.email = String(r.email)
  if (opt(r.note)) c.note = String(r.note)
  if (opt(r.updated_at)) c.updatedAt = String(r.updated_at)
  if (opt(r.paid_at)) c.paidAt = String(r.paid_at)
  return c
}

export function transactionToRow(t: Transaction, org: string): Row {
  return {
    organization_id: org,
    id: t.id,
    type: t.type,
    amount: t.amount,
    method: t.method,
    category: t.category,
    note: t.note,
    customer_id: t.customerId ?? null,
    customer_name: t.customerName ?? null,
    status: t.status,
    source: t.source ?? null,
    date: t.date,
    updated_at: t.updatedAt ?? null,
  }
}

export function rowToTransaction(r: Row): Transaction {
  const t: Transaction = {
    id: String(r.id),
    type: r.type as Transaction['type'],
    amount: Number(r.amount),
    method: r.method as Transaction['method'],
    category: r.category as Transaction['category'],
    note: String(r.note ?? ''),
    status: r.status as Transaction['status'],
    date: String(r.date),
  }
  if (opt(r.customer_id)) t.customerId = String(r.customer_id)
  if (opt(r.customer_name)) t.customerName = String(r.customer_name)
  if (opt(r.source)) t.source = r.source as Transaction['source']
  if (opt(r.updated_at)) t.updatedAt = String(r.updated_at)
  return t
}

export function courseToRow(c: Course, org: string): Row {
  return {
    organization_id: org,
    id: c.id,
    name: c.name,
    type: c.type,
    duration_months: c.durationMonths,
    monthly_price: c.monthlyPrice,
    active_groups: c.activeGroups,
    status: c.status,
    created_at: c.createdAt,
    updated_at: c.updatedAt ?? null,
  }
}

export function rowToCourse(r: Row): Course {
  const c: Course = {
    id: String(r.id),
    name: String(r.name),
    type: r.type as Course['type'],
    durationMonths: Number(r.duration_months),
    monthlyPrice: Number(r.monthly_price),
    activeGroups: Number(r.active_groups),
    status: r.status as Course['status'],
    createdAt: String(r.created_at),
  }
  if (opt(r.updated_at)) c.updatedAt = String(r.updated_at)
  return c
}
