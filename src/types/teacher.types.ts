// O'qituvchi (v11). Maosh qoidasi uch xil: belgilangan oylik, guruhlaridan yig'ilgan to'lovning foizi yoki
// har bir faol o'quvchi uchun summa (hisob — utils/payroll.ts)
export type PayRule = { type: 'fixed'; amount: number } | { type: 'percent'; percent: number } | { type: 'perStudent'; amount: number }

export type PayRuleType = PayRule['type']

export type TeacherStatus = 'active' | 'archived'

export interface Teacher {
  id: string
  name: string
  phone: string
  // Fanlar: "Ingliz tili", "IELTS" — erkin matn
  subjects: string[]
  payRule: PayRule
  // Tizimga kirishi bor bo'lsa — xodim (StaffUser / profiles) id'si; shu orqali "o'z guruhlari" aniqlanadi
  userId?: string
  status: TeacherStatus
  createdAt: string
  updatedAt?: string
}

export type TeacherInput = Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>
