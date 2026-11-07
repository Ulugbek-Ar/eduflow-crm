// Davomat hisoblari (sof funksiyalar)
import { tr } from '../i18n'
import type { AttendanceRecord, AttendanceStatus } from '../types/attendance.types'

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: tr('Keldi'),
  late: tr('Kechikdi'),
  absent: tr('Kelmadi'),
  excused: tr('Sababli'),
}

// Klaviatura: P — keldi, L — kechikdi, A — kelmadi, E — sababli
export const ATTENDANCE_KEYS: Record<string, AttendanceStatus> = { p: 'present', l: 'late', a: 'absent', e: 'excused' }

export const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = { present: 'P', late: 'L', absent: 'A', excused: 'E' }

// Davomat foizi = (keldi + kechikdi) / (keldi + kechikdi + kelmadi) × 100.
// "Sababli" (kasal, oldindan ogohlantirgan) maxrajga kirmaydi; belgilanmagan dars hisoblanmaydi. Yozuv bo'lmasa — null
export function attendanceRate(records: readonly Pick<AttendanceRecord, 'status'>[]): number | null {
  let came = 0
  let total = 0
  for (const r of records) {
    if (r.status === 'excused') continue
    total++
    if (r.status === 'present' || r.status === 'late') came++
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
