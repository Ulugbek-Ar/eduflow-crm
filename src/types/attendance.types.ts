// Davomat (v11): kalit (groupId, customerId, date) — noyob
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface AttendanceRecord {
  id: string
  groupId: string
  customerId: string
  // Dars sanasi, 'YYYY-MM-DD'
  date: string
  status: AttendanceStatus
  note?: string
  // Kim belgiladi (xodim ismi)
  markedBy?: string
  updatedAt: string
}

// Bekor qilingan dars (bayram, o'qituvchi kasal va h.k.): shu kun dars sanalaridan chiqariladi
export interface LessonException {
  id: string
  groupId: string
  date: string
  reason: string
}
