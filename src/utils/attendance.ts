// Davomat hisoblari (sof funksiyalar)
import { tr } from '../i18n'
import type { AttendanceRecord, AttendanceStatus, LessonException } from '../types/attendance.types'
import type { Enrollment, Group } from '../types/group.types'
import { addDays, enrollmentActiveOn, hasLessonOn, minutesOf, parseDay, weekdayOf } from './groups'

// Davomatda faqat ikki holat: Keldi / Kelmadi. Eski yozuvlardagi "Kechikdi" (late) — Keldi, "Sababli" (excused) —
// Kelmadi deb ko'rsatiladi va hisoblanadi; saqlangan ma'lumot o'zgartirilmaydi (zaxiralar va bulut bilan moslik)
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = ['present', 'absent']

export function simpleStatus(status: AttendanceStatus): 'present' | 'absent' {
  return status === 'present' || status === 'late' ? 'present' : 'absent'
}

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: tr('Keldi'),
  late: tr('Keldi'),
  absent: tr('Kelmadi'),
  excused: tr('Kelmadi'),
}

// Klaviatura: P, K yoki 1 — keldi; A, Y yoki 0 — kelmadi
export const ATTENDANCE_KEYS: Record<string, AttendanceStatus> = { p: 'present', k: 'present', '1': 'present', a: 'absent', y: 'absent', '0': 'absent' }

export const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = { present: '✓', late: '✓', absent: '✗', excused: '✗' }

// Davomat foizi = keldi / (keldi + kelmadi) × 100; belgilanmagan dars hisoblanmaydi. Yozuv bo'lmasa — null
export function attendanceRate(records: readonly Pick<AttendanceRecord, 'status'>[]): number | null {
  let came = 0
  let total = 0
  for (const r of records) {
    total++
    if (simpleStatus(r.status) === 'present') came++
  }
  return total > 0 ? (came / total) * 100 : null
}

export function rateLabel(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate)}%`
}

export function recordsFor(records: readonly AttendanceRecord[], filter: { customerId?: string; groupId?: string; from?: string; to?: string }): AttendanceRecord[] {
  return records.filter(
    (r) =>
      (!filter.customerId || r.customerId === filter.customerId) &&
      (!filter.groupId || r.groupId === filter.groupId) &&
      (!filter.from || r.date >= filter.from) &&
      (!filter.to || r.date <= filter.to),
  )
}

// ===== Dars sanalari =====
// Guruh kunlaridan: startDate dan endDate (yoki bugun) gacha, so'ralgan oraliq ichida; bekor qilingan darslar chiqariladi
export function lessonDates(
  group: Pick<Group, 'id' | 'days' | 'startDate' | 'endDate'>,
  from: string,
  to: string,
  exceptions: readonly Pick<LessonException, 'groupId' | 'date'>[],
  today: string,
): string[] {
  const start = group.startDate > from ? group.startDate : from
  const limit = [to, today, group.endDate ?? to].reduce((min, d) => (d < min ? d : min))
  const cancelled = new Set(exceptions.filter((e) => e.groupId === group.id).map((e) => e.date))
  const result: string[] = []
  for (let day = start; day <= limit; day = addDays(day, 1)) {
    if (group.days.includes(weekdayOf(parseDay(day))) && !cancelled.has(day)) result.push(day)
  }
  return result
}

// O'quvchining shu guruhdagi oxirgi belgilangan darslarida ketma-ket "Kelmadi" soni
export function trailingAbsences(records: readonly AttendanceRecord[], customerId: string, groupId: string): number {
  const own = records.filter((r) => r.customerId === customerId && r.groupId === groupId).sort((a, b) => b.date.localeCompare(a.date))
  let count = 0
  for (const r of own) {
    if (simpleStatus(r.status) !== 'absent') break
    count++
  }
  return count
}

export interface AbsentStreak {
  customerId: string
  groupId: string
  count: number
}

// Ketma-ket N (standart 3) va undan ko'p darsga kelmagan faol o'quvchilar
export function absentStreaks(enrollments: readonly Enrollment[], records: readonly AttendanceRecord[], today: string, min = 3): AbsentStreak[] {
  const result: AbsentStreak[] = []
  for (const e of enrollments) {
    if (!enrollmentActiveOn(e, today)) continue
    const count = trailingAbsences(records, e.customerId, e.groupId)
    if (count >= min) result.push({ customerId: e.customerId, groupId: e.groupId, count })
  }
  return result
}

export interface LessonSlot {
  group: Group
  date: string
  // Dars tugaganmi (bugun uchun — hozirgi vaqtga nisbatan)
  ended: boolean
  // Faol o'quvchilar soni va belgilanganlar
  students: number
  marked: number
}

// Bugungi darslar (vaqt bo'yicha): o'quvchilar va davomat belgilangani
export function todayLessons(
  groups: readonly Group[],
  enrollments: readonly Enrollment[],
  records: readonly AttendanceRecord[],
  exceptions: readonly LessonException[],
  today: string,
  nowMinutes: number,
): LessonSlot[] {
  return groups
    .filter((g) => hasLessonOn(g, today) && !exceptions.some((e) => e.groupId === g.id && e.date === today))
    .map((group) => {
      const active = enrollments.filter((e) => e.groupId === group.id && enrollmentActiveOn(e, today))
      const ids = new Set(active.map((e) => e.customerId))
      const marked = records.filter((r) => r.groupId === group.id && r.date === today && ids.has(r.customerId)).length
      return { group, date: today, ended: minutesOf(group.endTime) <= nowMinutes, students: active.length, marked }
    })
    .sort((a, b) => a.group.startTime.localeCompare(b.group.startTime))
}

// Dars tugagan, lekin davomat umuman belgilanmagan (o'quvchisi bor darslar)
export function unmarkedLessons(slots: readonly LessonSlot[]): LessonSlot[] {
  return slots.filter((s) => s.ended && s.students > 0 && s.marked === 0)
}

// O'qituvchi bo'yicha davomat foizi (uning guruhlaridagi barcha belgilar)
export function teacherAttendanceRate(teacherId: string, groups: readonly Group[], records: readonly AttendanceRecord[], from?: string, to?: string): number | null {
  const ids = new Set(groups.filter((g) => g.teacherId === teacherId).map((g) => g.id))
  return attendanceRate(records.filter((r) => ids.has(r.groupId) && (!from || r.date >= from) && (!to || r.date <= to)))
}

// Katak bosilganda: bo'sh -> keldi -> kelmadi -> keldi ...
export function nextStatus(current: AttendanceStatus | undefined): AttendanceStatus {
  return current && simpleStatus(current) === 'present' ? 'absent' : 'present'
}
