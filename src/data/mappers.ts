// Ilova modellari <-> Supabase qatorlari (snake_case). Bo'sh ixtiyoriy maydonlar null bo'ladi
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { AttendanceRecord, LessonException } from '../types/attendance.types'
import type { Branch } from '../types/branch.types'
import type { Enrollment, Group, Weekday } from '../types/group.types'
import type { PayRule, Teacher } from '../types/teacher.types'

export type Row = Record<string, unknown>

const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v)

// v12: branch_id faqat filial berilgan (yoki aniq olib tashlangan — '') yozuvda yuboriladi: filiallar migratsiyasi
// qo'llanmagan bazada filialsiz markaz avvalgidek ishlaydi
const branchColumn = (branchId: string | undefined): Row => (branchId === undefined ? {} : { branch_id: branchId || null })

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
    ...branchColumn(c.branchId),
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
  if (opt(r.branch_id)) c.branchId = String(r.branch_id)
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
    enrollment_id: t.enrollmentId ?? null,
    teacher_id: t.teacherId ?? null,
    period: t.period ?? null,
    // Onlayn to'lov maydonlari faqat shunday kirimda yuboriladi (migratsiya qo'llanmagan bazada oddiy kirim ishlayveradi)
    ...(t.provider ? { provider: t.provider, provider_ref: t.providerRef ?? null } : {}),
    ...branchColumn(t.branchId),
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
  if (opt(r.enrollment_id)) t.enrollmentId = String(r.enrollment_id)
  if (opt(r.teacher_id)) t.teacherId = String(r.teacher_id)
  if (opt(r.period)) t.period = String(r.period)
  if (r.provider === 'payme' || r.provider === 'click') t.provider = r.provider
  if (opt(r.provider_ref)) t.providerRef = String(r.provider_ref)
  if (opt(r.branch_id)) t.branchId = String(r.branch_id)
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
    status: r.status as Course['status'],
    createdAt: String(r.created_at),
  }
  if (opt(r.updated_at)) c.updatedAt = String(r.updated_at)
  return c
}

// ===== v11: o'qituvchi, guruh, o'qish, davomat, bekor qilingan dars =====

// Postgres 'time' -> 'HH:MM' ("14:00:00" -> "14:00")
const hhmm = (value: unknown) => String(value ?? '').slice(0, 5)
// Postgres 'date' -> 'YYYY-MM-DD'
const day = (value: unknown) => String(value ?? '').slice(0, 10)

export function teacherToRow(t: Teacher, org: string): Row {
  return {
    organization_id: org,
    id: t.id,
    name: t.name,
    phone: t.phone,
    subjects: t.subjects,
    pay_rule: t.payRule,
    user_id: t.userId ?? null,
    status: t.status,
    created_at: t.createdAt,
    updated_at: t.updatedAt ?? null,
  }
}

export function rowToTeacher(r: Row): Teacher {
  const t: Teacher = {
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone ?? ''),
    subjects: Array.isArray(r.subjects) ? r.subjects.map(String) : [],
    payRule: (r.pay_rule ?? { type: 'fixed', amount: 0 }) as PayRule,
    status: r.status as Teacher['status'],
    createdAt: String(r.created_at),
  }
  if (opt(r.user_id)) t.userId = String(r.user_id)
  if (opt(r.updated_at)) t.updatedAt = String(r.updated_at)
  return t
}

export function groupToRow(g: Group, org: string): Row {
  return {
    organization_id: org,
    id: g.id,
    name: g.name,
    course_id: g.courseId,
    teacher_id: g.teacherId ?? null,
    room: g.room,
    days: g.days,
    start_time: g.startTime,
    end_time: g.endTime,
    capacity: g.capacity,
    start_date: g.startDate,
    end_date: g.endDate ?? null,
    status: g.status,
    created_at: g.createdAt,
    updated_at: g.updatedAt ?? null,
    ...branchColumn(g.branchId),
  }
}

export function rowToGroup(r: Row): Group {
  const g: Group = {
    id: String(r.id),
    name: String(r.name),
    courseId: String(r.course_id),
    room: String(r.room ?? ''),
    days: (Array.isArray(r.days) ? r.days : []) as Weekday[],
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    capacity: Number(r.capacity),
    startDate: day(r.start_date),
    status: r.status as Group['status'],
    createdAt: String(r.created_at),
  }
  if (opt(r.teacher_id)) g.teacherId = String(r.teacher_id)
  if (opt(r.end_date)) g.endDate = day(r.end_date)
  if (opt(r.updated_at)) g.updatedAt = String(r.updated_at)
  if (opt(r.branch_id)) g.branchId = String(r.branch_id)
  return g
}

export function enrollmentToRow(e: Enrollment, org: string): Row {
  return {
    organization_id: org,
    id: e.id,
    customer_id: e.customerId,
    group_id: e.groupId,
    start_date: e.startDate,
    end_date: e.endDate ?? null,
    price_override: e.priceOverride ?? null,
    discount_percent: e.discountPercent ?? null,
    status: e.status,
    paused_from: e.pausedFrom ?? null,
    paused_to: e.pausedTo ?? null,
    created_at: e.createdAt,
    updated_at: e.updatedAt ?? null,
  }
}

export function rowToEnrollment(r: Row): Enrollment {
  const e: Enrollment = {
    id: String(r.id),
    customerId: String(r.customer_id),
    groupId: String(r.group_id),
    startDate: day(r.start_date),
    status: r.status as Enrollment['status'],
    createdAt: String(r.created_at),
  }
  if (opt(r.end_date)) e.endDate = day(r.end_date)
  if (opt(r.price_override)) e.priceOverride = Number(r.price_override)
  if (opt(r.discount_percent)) e.discountPercent = Number(r.discount_percent)
  if (opt(r.paused_from)) e.pausedFrom = day(r.paused_from)
  if (opt(r.paused_to)) e.pausedTo = day(r.paused_to)
  if (opt(r.updated_at)) e.updatedAt = String(r.updated_at)
  return e
}

export function attendanceToRow(a: AttendanceRecord, org: string): Row {
  return {
    organization_id: org,
    id: a.id,
    group_id: a.groupId,
    customer_id: a.customerId,
    date: a.date,
    status: a.status,
    note: a.note ?? null,
    marked_by: a.markedBy ?? null,
    updated_at: a.updatedAt,
  }
}

export function rowToAttendance(r: Row): AttendanceRecord {
  const a: AttendanceRecord = {
    id: String(r.id),
    groupId: String(r.group_id),
    customerId: String(r.customer_id),
    date: day(r.date),
    status: r.status as AttendanceRecord['status'],
    updatedAt: String(r.updated_at),
  }
  if (opt(r.note)) a.note = String(r.note)
  if (opt(r.marked_by)) a.markedBy = String(r.marked_by)
  return a
}

export function exceptionToRow(e: LessonException, org: string): Row {
  return { organization_id: org, id: e.id, group_id: e.groupId, date: e.date, reason: e.reason }
}

export function rowToException(r: Row): LessonException {
  return { id: String(r.id), groupId: String(r.group_id), date: day(r.date), reason: String(r.reason ?? '') }
}

// ===== v12: filial =====
export function branchToRow(b: Branch, org: string): Row {
  return {
    organization_id: org,
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    status: b.status,
    created_at: b.createdAt,
    updated_at: b.updatedAt ?? null,
  }
}

export function rowToBranch(r: Row): Branch {
  const b: Branch = {
    id: String(r.id),
    name: String(r.name),
    address: String(r.address ?? ''),
    phone: String(r.phone ?? ''),
    status: r.status === 'archived' ? 'archived' : 'active',
    createdAt: String(r.created_at),
  }
  if (opt(r.updated_at)) b.updatedAt = String(r.updated_at)
  return b
}
