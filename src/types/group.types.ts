// Guruh va o'quvchining guruhga yozilishi (v11). O'quvchining haqiqiy o'qishi Enrollment orqali yuritiladi;
// Customer.course — lidning "qiziqqan kursi" ma'nosida qoladi
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type GroupStatus = 'active' | 'finished' | 'archived'

export interface Group {
  id: string
  name: string
  courseId: string
  teacherId?: string
  // '' — xona ko'rsatilmagan (ziddiyat tekshiruvida xona hisobga olinmaydi)
  room: string
  days: Weekday[]
  // 'HH:MM'
  startTime: string
  endTime: string
  capacity: number
  // 'YYYY-MM-DD'
  startDate: string
  endDate?: string
  status: GroupStatus
  // v12: qaysi filialda o'tadi (xona ziddiyati shu filial ichida tekshiriladi)
  branchId?: string
  createdAt: string
  updatedAt?: string
}

export type GroupInput = Omit<Group, 'id' | 'createdAt' | 'updatedAt'>

export type EnrollmentStatus = 'active' | 'paused' | 'finished' | 'left'

export interface Enrollment {
  id: string
  customerId: string
  groupId: string
  // 'YYYY-MM-DD'
  startDate: string
  // Tugash yoki ketish sanasi (shu kundan keyingi oylar hisoblanmaydi)
  endDate?: string
  // Individual oylik narx (kurs narxi o'rniga)
  priceOverride?: number
  // Chegirma, % (0–100)
  discountPercent?: number
  status: EnrollmentStatus
  // Pauza oralig'i, 'YYYY-MM-DD' (shu oylar hisoblanmaydi)
  pausedFrom?: string
  pausedTo?: string
  createdAt: string
  updatedAt?: string
}

export type EnrollmentInput = Omit<Enrollment, 'id' | 'createdAt' | 'updatedAt'>
