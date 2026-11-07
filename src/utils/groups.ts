// Guruhlar, o'qish (enrollment) va dars vaqtlari bo'yicha sof funksiyalar
import { tr } from '../i18n'
import type { Course } from '../types/course.types'
import type { Enrollment, EnrollmentStatus, Group, GroupStatus, Weekday } from '../types/group.types'
import type { Teacher } from '../types/teacher.types'

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: tr('Du'),
  tue: tr('Se'),
  wed: tr('Cho'),
  thu: tr('Pa'),
  fri: tr('Ju'),
  sat: tr('Sha'),
  sun: tr('Ya'),
}

export const WEEKDAY_LONG: Record<Weekday, string> = {
  mon: tr('Dushanba'),
  tue: tr('Seshanba'),
  wed: tr('Chorshanba'),
  thu: tr('Payshanba'),
  fri: tr('Juma'),
  sat: tr('Shanba'),
  sun: tr('Yakshanba'),
}

export const GROUP_STATUS_LABELS: Record<GroupStatus, string> = {
  active: tr('Faol'),
  finished: tr('Tugagan'),
  archived: tr('Arxiv'),
}

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: tr('O\'qiyapti'),
  paused: tr('Pauzada'),
  finished: tr('Tugatgan'),
  left: tr('Ketgan'),
}

// Date.getDay(): 0 — yakshanba
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7]
}

// 'YYYY-MM-DD' (mahalliy vaqt)
export function dayString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(day: string, days: number): string {
  const date = parseDay(day)
  date.setDate(date.getDate() + days)
  return dayString(date)
}

// 'HH:MM' -> daqiqa
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function sortDays(days: readonly Weekday[]): Weekday[] {
  return WEEKDAYS.filter((d) => days.includes(d))
}

export function daysLabel(days: readonly Weekday[]): string {
  return sortDays(days)
    .map((d) => WEEKDAY_SHORT[d])
    .join('/')
}

export function scheduleLabel(group: Pick<Group, 'days' | 'startTime' | 'endTime'>): string {
  return `${daysLabel(group.days)} · ${group.startTime}–${group.endTime}`
}

// O'qish shu kuni faolmi: boshlangan, tugamagan, pauzada emas
export function enrollmentActiveOn(enrollment: Enrollment, day: string): boolean {
  if (enrollment.startDate > day) return false
  if (enrollment.endDate && enrollment.endDate < day) return false
  if (enrollment.status === 'left' || enrollment.status === 'finished') {
    // Tugash sanasi bo'lmasa — endi faol emas
    if (!enrollment.endDate) return false
  }
  if (enrollment.pausedFrom && enrollment.pausedFrom <= day && (!enrollment.pausedTo || enrollment.pausedTo >= day)) return false
  // Sanasiz pauza — pauza davom etmoqda
  if (enrollment.status === 'paused' && !enrollment.pausedFrom) return false
  return true
}

// Hozir guruhda o'qiyotganlar (pauzadagilar ham o'rinni egallaydi — sig'im uchun)
export function occupiesSeat(enrollment: Enrollment, day: string): boolean {
  if (enrollment.startDate > day) return enrollment.status === 'active'
  if (enrollment.endDate && enrollment.endDate < day) return false
  return enrollment.status === 'active' || enrollment.status === 'paused'
}

export function groupEnrollments(groupId: string, enrollments: readonly Enrollment[]): Enrollment[] {
  return enrollments.filter((e) => e.groupId === groupId)
}

// Sig'im hisobidagi o'quvchilar soni
export function seatsTaken(groupId: string, enrollments: readonly Enrollment[], today: string): number {
  return enrollments.filter((e) => e.groupId === groupId && occupiesSeat(e, today)).length
}

// Kursning faol guruhlari soni (v10 dagi Course.activeGroups o'rniga)
export function activeGroupCount(courseId: string, groups: readonly Group[]): number {
  return groups.filter((g) => g.courseId === courseId && g.status === 'active').length
}

export function hasLessonOn(group: Pick<Group, 'days' | 'status' | 'startDate' | 'endDate'>, day: string): boolean {
  if (group.status !== 'active' || group.startDate > day || (group.endDate && group.endDate < day)) return false
  return group.days.includes(weekdayOf(parseDay(day)))
}

// Oylik summa: (individual narx ?? kurs narxi) × (1 − chegirma%)
export function enrollmentMonthlyFee(enrollment: Pick<Enrollment, 'priceOverride' | 'discountPercent'>, course: Pick<Course, 'monthlyPrice'> | undefined): number {
  const base = enrollment.priceOverride ?? course?.monthlyPrice ?? 0
  const discount = Math.min(100, Math.max(0, enrollment.discountPercent ?? 0))
  return Math.round(base * (1 - discount / 100))
}

// O'quvchining guruhlari (eng yangisi birinchi)
export function customerEnrollments(customerId: string, enrollments: readonly Enrollment[]): Enrollment[] {
  return enrollments.filter((e) => e.customerId === customerId).sort((a, b) => b.startDate.localeCompare(a.startDate))
}

// Davr oxirida faol o'quvchilar (KPI "Faol mijozlar"): guruhda o'qiyotgan, pauzada bo'lmagan; bir o'quvchi bir marta
export function activeStudentsOn(enrollments: readonly Enrollment[], day: string): number {
  return new Set(enrollments.filter((e) => enrollmentActiveOn(e, day)).map((e) => e.customerId)).size
}

export function teacherGroups(teacherId: string, groups: readonly Group[]): Group[] {
  return groups.filter((g) => g.teacherId === teacherId)
}

// O'qituvchi sifatida kirgan xodimning o'qituvchi yozuvi
export function teacherForUser(userId: string | undefined, teachers: readonly Teacher[]): Teacher | undefined {
  return userId ? teachers.find((t) => t.userId === userId && t.status === 'active') : undefined
}

export function groupLabel(group: Group | undefined): string {
  return group?.name ?? tr('O\'chirilgan guruh')
}
