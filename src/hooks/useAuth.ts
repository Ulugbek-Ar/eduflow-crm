import { createContext, useContext } from 'react'
import type { Permission } from '../auth/permissions'
import type { AuditActor } from '../services/audit.service'
import type { Access, Subscription } from '../services/subscription.service'
import type { StorageNamespace, StoredData } from '../services/storage.service'
import type { CloudOrg, CloudSnapshot, CloudSync } from '../data/supabase'
import { displayName } from '../services/users.service'
import type { NewUserInput, UserField, UserPatch } from '../services/users.service'
import type { PublicUser, Role, SessionRecord } from '../types/user.types'

export type ActionResult = { ok: true } | { ok: false; field?: UserField; error: string }

export type LoginResult = { ok: true } | { ok: false; reason: 'invalid' | 'blocked' }

// Bulutli rejimga xos imkoniyatlar (lokal rejimda undefined)
export interface CloudAuthExtras {
  org: CloudOrg | null
  loadSnapshot: () => Promise<CloudSnapshot>
  createSync: (snapshot: CloudSnapshot) => CloudSync
  signUp: (input: { email: string; password: string; orgName: string; fullName: string; title: string }) => Promise<ActionResult & { confirmEmail?: boolean }>
  sendPasswordReset: (email: string) => Promise<ActionResult>
  importLocal: (data: StoredData) => Promise<ActionResult>
}

export interface AuthContextValue {
  // Bulutda seans tekshirilayotganda true
  loading?: boolean
  cloud?: CloudAuthExtras
  // Kirgan xodim (bo'lmasa null). Parol xeshi bu yerga chiqmaydi
  user: PublicUser | null
  sessionId: string | null
  // 'demo' — namunaviy markaz (alohida ma'lumot), 'main' — haqiqiy
  mode: StorageNamespace
  // Hali birorta xodim yo'q — administrator hisobini yaratish ekrani
  needsSetup: boolean
  can: (permission: Permission) => boolean
  // Tarif: sinov / faol / tugayapti / tugagan / bloklangan
  subscription: Subscription
  access: Access
  login: (login: string, password: string) => Promise<LoginResult>
  logout: () => void
  setupAdmin: (input: Omit<NewUserInput, 'role'>) => Promise<ActionResult>
  completePasswordChange: (newPassword: string) => Promise<ActionResult>
  changeOwnCredentials: (currentPassword: string, newLogin: string, newPassword: string) => Promise<ActionResult>
  updateOwnProfile: (fullName: string, title: string) => ActionResult
  users: PublicUser[]
  // Muvaffaqiyatda yangi xodim id'si (o'qituvchi yozuviga bog'lash uchun)
  addUser: (input: NewUserInput) => Promise<ActionResult & { userId?: string }>
  updateUser: (id: string, patch: UserPatch) => ActionResult
  // Natijada yangi vaqtinchalik parol (faqat bir marta ko'rsatiladi)
  resetPassword: (id: string) => Promise<{ ok: true; password: string } | { ok: false; error: string }>
  sessions: SessionRecord[]
  revokeSession: (id: string) => void
  revokeOtherSessions: () => void
  enterDemo: (role?: Role) => void
  exitDemo: () => void
  switchDemoRole: (role: Role) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak')
  return context
}

// Jurnal uchun: amalni kim bajarayotgani (AuthProvider bo'lmasa — null)
export function useAuditActor(): AuditActor | null {
  const user = useContext(AuthContext)?.user
  return user ? { userId: user.id, userName: displayName(user), role: user.role } : null
}

// Ruxsat tekshiruvi: AuthProvider bo'lmasa (alohida komponent testlari) — hamma narsa ochiq
export function useCan(): (permission: Permission) => boolean {
  const context = useContext(AuthContext)
  return context ? context.can : () => true
}
