// Kirim qaysi guruhga (o'qishga) tegishli — o'qituvchi maoshi va guruh bo'yicha qarz uchun yagona qoida:
//   1. Tranzaksiyada enrollmentId bo'lsa (va bunday o'qish bor bo'lsa) — o'sha o'qish (guruh).
//   2. Bo'lmasa — to'lov sanasida o'quvchining shu kurs (Customer.course) bo'yicha faol o'qishi; bir nechta bo'lsa —
//      eng oldin boshlangani.
//   3. Bunday o'qish ham topilmasa — kirim hech bir guruhga (va maoshga) hisoblanmaydi.
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { Enrollment, Group } from '../types/group.types'
import { dayString, enrollmentActiveOn } from './groups'

export interface AttributionContext {
  enrollments: readonly Enrollment[]
  groups: readonly Group[]
  courses: readonly Course[]
  customers: readonly Customer[]
}

export function attributeIncome(t: Pick<Transaction, 'type' | 'category' | 'enrollmentId' | 'customerId' | 'date'>, ctx: AttributionContext): Enrollment | null {
  if (t.type !== 'income') return null
  if (t.enrollmentId) {
    const linked = ctx.enrollments.find((e) => e.id === t.enrollmentId)
    if (linked) return linked
  }
  if (!t.customerId) return null
  const customer = ctx.customers.find((c) => c.id === t.customerId)
  if (!customer) return null
  const day = dayString(new Date(t.date))
  const candidates = ctx.enrollments
    .filter((e) => e.customerId === customer.id && enrollmentActiveOn(e, day))
    .filter((e) => {
      const group = ctx.groups.find((g) => g.id === e.groupId)
      const course = ctx.courses.find((c) => c.id === group?.courseId)
      return course?.name === customer.course
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  return candidates[0] ?? null
}

// Kirimlarni o'qish id'si bo'yicha guruhlash (faqat "To'langan" kurs to'lovlari va boshqa kirimlar)
export function incomesByEnrollment(transactions: readonly Transaction[], ctx: AttributionContext): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.type !== 'income' || t.status !== 'paid') continue
    const enrollment = attributeIncome(t, ctx)
    if (!enrollment) continue
    const list = map.get(enrollment.id) ?? []
    list.push(t)
    map.set(enrollment.id, list)
  }
  return map
}
