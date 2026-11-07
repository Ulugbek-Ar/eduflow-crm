import type { HashAlgo } from '../services/auth.service'

// Rollar: Administrator — hamma narsa; Menejer — mijozlar, lidlar, guruhlar, to'lov qabul qilish;
// Kassir / Buxgalter — moliya, maosh va hisobotlar; Kuzatuvchi — faqat ko'rish;
// O'qituvchi (v11) — faqat o'z guruhlari, jadvali va davomati
export type Role = 'admin' | 'manager' | 'cashier' | 'viewer' | 'teacher'

export type UserStatus = 'active' | 'blocked'

// Xodim (localStorage'dagi lokal rejim). Supabase rejimida parol bazada emas, Auth'da saqlanadi
export interface StaffUser {
  id: string
  login: string
  fullName: string
  // Lavozim (erkin matn, masalan "Direktor") — ruxsatlarga ta'sir qilmaydi
  title: string
  role: Role
  status: UserStatus
  salt: string
  passwordHash: string
  algo: HashAlgo
  iterations: number
  // Vaqtinchalik parol: keyingi kirishda almashtirish majburiy
  mustChange: boolean
  createdAt: string
  updatedAt?: string
  lastLoginAt?: string
}

// Interfeysga beriladigan ko'rinish — parol xeshi hech qachon komponentlarga chiqmaydi
export type PublicUser = Omit<StaffUser, 'salt' | 'passwordHash' | 'algo' | 'iterations'>

export interface SessionRecord {
  id: string
  userId: string
  startedAt: string
  lastSeenAt: string
  // "Chrome · Windows" kabi qisqa tavsif
  device: string
}
