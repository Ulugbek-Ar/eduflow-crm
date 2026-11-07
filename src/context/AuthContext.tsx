import { tr } from '../i18n'
import { useEffect, useEffectEvent, useState } from 'react'
import type { ReactNode } from 'react'
import { can as roleCan, ROLE_LABELS } from '../auth/permissions'
import type { Permission } from '../auth/permissions'
import { AuthContext } from '../hooks/useAuth'
import type { ActionResult, AuthContextValue } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { logAudit } from '../services/audit.service'
import type { AuditAction } from '../services/audit.service'
import { isCloudEnabled } from '../data/config'
import { closeDemoWorkspace, openDemoWorkspace } from '../services/demo.service'
import { loadDemoData } from '../services/demo/load'
import { computeAccess, loadSubscription, startTrialIfMissing } from '../services/subscription.service'
import {
  endSession,
  isSessionActive,
  listSessions,
  readTabSession,
  revokeOtherSessions,
  revokeSession,
  revokeUserSessions,
  SESSIONS_KEY,
  startSession,
  touchSession,
} from '../services/sessions.service'
import type { TabSession } from '../services/sessions.service'
import { getStorageNamespace, physicalKey } from '../services/storage.service'
import * as staff from '../services/users.service'
import type { StaffUser } from '../types/user.types'

const TOUCH_EVERY_MS = 5 * 60_000

// Shu tabdagi seans haqiqiymi: xodim bor, faol va seans yopilmagan.
// Eski format ({ login }) bo'lsa — login orqali yangi seansga aylantiriladi (yangilanishdan keyin qayta kirish shart emas)
function resolveSession(users: readonly StaffUser[]): TabSession | null {
  const stored = readTabSession()
  if (!stored) return null
  if ('legacyLogin' in stored) {
    const user = users.find((u) => u.status === 'active' && u.login.toLowerCase() === stored.legacyLogin.toLowerCase())
    if (user) return startSession(user.id)
    endSession()
    return null
  }
  const user = users.find((u) => u.id === stored.userId)
  if (!user || user.status !== 'active' || !isSessionActive(stored.id)) {
    endSession()
    return null
  }
  touchSession(stored.id)
  return stored
}

function initialAuthState() {
  let mode = getStorageNamespace()
  let users = staff.loadUsers()
  let session = resolveSession(users)
  // Demo tugagan (boshqa tabda chiqilgan) — haqiqiy rejimga qaytiladi
  if (mode === 'demo' && !session) {
    closeDemoWorkspace()
    mode = 'main'
    users = staff.loadUsers()
    session = resolveSession(users)
  }
  return { mode, users, session, sessions: listSessions() }
}

const DENIED: ActionResult = { ok: false, error: tr('Bu amal uchun ruxsatingiz yo\'q') }

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [initial] = useState(initialAuthState)
  const [mode, setMode] = useState(initial.mode)
  const [users, setUsers] = useState(initial.users)
  const [session, setSession] = useState(initial.session)
  const [sessions, setSessions] = useState(initial.sessions)
  const [subscription, setSubscription] = useState(loadSubscription)
  // Muddat tugaganda kun bo'yi qayta hisoblanmasligi uchun — sahifa ochilgan vaqt
  const [openedAt] = useState(Date.now)
  const access = computeAccess(subscription, openedAt)

  const current = session ? users.find((u) => u.id === session.userId && u.status === 'active') : undefined
  // Tarif muddati tugagan yoki bloklangan (majburiy rejim) — faqat ko'rish
  const allowed = (permission: Permission) =>
    roleCan(current?.role, permission) && (!access.readOnly || permission.endsWith('.view'))
  const actorOf = (user: StaffUser) => ({ userId: user.id, userName: staff.displayName(user), role: user.role })
  const audit = (action: AuditAction, summary: string, entityId?: string, by: StaffUser | undefined = current) =>
    logAudit(by ? actorOf(by) : null, action, summary, entityId)
  const nameOf = (id: string) => {
    const user = users.find((u) => u.id === id)
    return user ? staff.displayName(user) : 'Xodim'
  }

  const leaveDemo = () => {
    if (session) endSession(session.id)
    closeDemoWorkspace()
    // Bulutli rejim yoqilgan bo'lsa — haqiqiy (Supabase) kirishga qaytish uchun sahifa qayta ochiladi
    if (isCloudEnabled()) {
      window.location.reload()
      return
    }
    setMode('main')
    setSubscription(loadSubscription())
    setUsers(staff.loadUsers())
    setSession(null)
    setSessions(listSessions())
  }

  // Boshqa tabda xodim bloklansa, seans yopilsa yoki demo tugasa — bu tab ham darhol chiqadi
  const resync = useEffectEvent(() => {
    const nextUsers = staff.loadUsers()
    setUsers(nextUsers)
    setSessions(listSessions())
    if (!session) return
    const user = nextUsers.find((u) => u.id === session.userId)
    if (user && user.status === 'active' && isSessionActive(session.id)) return
    if (mode === 'demo') {
      leaveDemo()
      return
    }
    endSession()
    setSession(null)
    toast.info(user?.status === 'blocked' ? tr('Hisobingiz bloklandi. Administratorga murojaat qiling.') : tr('Seansingiz yopildi. Qaytadan kiring.'))
  })

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      if (event.key !== null && event.key !== physicalKey(staff.USERS_KEY) && event.key !== physicalKey(SESSIONS_KEY)) return
      resync()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Faollik: "oxirgi ko'rilgan" vaqti seanslar ro'yxatida yangilanib turadi
  const sessionId = session?.id
  useEffect(() => {
    if (!sessionId) return
    const timer = window.setInterval(() => touchSession(sessionId), TOUCH_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [sessionId])

  const begin = (user: StaffUser, list: StaffUser[]) => {
    setUsers(list)
    setSession(startSession(user.id))
    setSessions(listSessions())
  }

  const fromResult = (result: staff.UserResult): ActionResult => {
    if (!result.ok) return result
    setUsers(result.users)
    return { ok: true }
  }

  const value: AuthContextValue = {
    user: current ? staff.toPublicUser(current) : null,
    sessionId: session?.id ?? null,
    mode,
    needsSetup: mode === 'main' && users.length === 0,
    can: allowed,
    subscription,
    access,
    login: async (login, password) => {
      const result = await staff.authenticate(login, password)
      if (!result.ok) {
        // Kim urinayotgani noma'lum — kiritilgan login yoziladi (parol hech qachon yozilmaydi)
        logAudit(null, 'auth.failed', `${result.reason === 'blocked' ? 'Bloklangan hisob' : 'Noto\'g\'ri login yoki parol'}: ${login.trim().slice(0, 32)}`)
        return result
      }
      begin(result.user, result.users)
      audit('auth.login', result.user.login, result.user.id, result.user)
      return { ok: true }
    },
    logout: () => {
      if (mode === 'demo') return leaveDemo()
      if (current) audit('auth.logout', current.login, current.id)
      if (session) endSession(session.id)
      setSession(null)
      setSessions(listSessions())
    },
    setupAdmin: async (input) => {
      const result = await staff.createFirstAdmin(input)
      if (!result.ok) return result
      startTrialIfMissing()
      setSubscription(loadSubscription())
      begin(result.user, result.users)
      audit('staff.create', `Birinchi administrator: ${staff.displayName(result.user)}`, result.user.id, result.user)
      return { ok: true }
    },
    completePasswordChange: async (newPassword) => {
      if (!current) return DENIED
      const result = await staff.completePasswordChange(current.id, newPassword)
      if (result.ok) audit('auth.password', 'Vaqtinchalik parol almashtirildi', current.id)
      return fromResult(result)
    },
    changeOwnCredentials: async (currentPassword, newLogin, newPassword) => {
      if (!current) return DENIED
      const result = await staff.changeOwnCredentials(current.id, currentPassword, newLogin, newPassword)
      if (result.ok) {
        const changes = [newPassword ? 'parol' : '', result.user.login !== current.login ? `login: ${current.login} → ${result.user.login}` : '']
        audit('auth.password', changes.filter(Boolean).join(', ') || 'parol xeshi yangilandi', current.id)
      }
      return fromResult(result)
    },
    updateOwnProfile: (fullName, title) => {
      if (!current) return DENIED
      return fromResult(staff.updateOwnProfile(current.id, fullName, title))
    },
    users: users.map(staff.toPublicUser),
    addUser: async (input) => {
      if (!allowed('staff.manage')) return DENIED
      // O'qituvchi kirishlari tarif limitiga kirmaydi (markazda o'qituvchilar ko'p bo'ladi)
      const activeCount = users.filter((u) => u.status === 'active' && u.role !== 'teacher').length
      if (input.role !== 'teacher' && access.staffLimit !== null && activeCount >= access.staffLimit) {
        return { ok: false, error: tr('Tarifingizda {0} tagacha xodim. Ko\'proq xodim uchun tarifni almashtiring.', { 0: access.staffLimit }) }
      }
      const result = await staff.addUser(input)
      if (result.ok) audit('staff.create', `${staff.displayName(result.user)} (${ROLE_LABELS[result.user.role]})`, result.user.id)
      return fromResult(result)
    },
    updateUser: (id, patch) => {
      if (!current || !allowed('staff.manage')) return DENIED
      const before = users.find((u) => u.id === id)
      const result = staff.updateUser(current.id, id, patch)
      if (result.ok && patch.status === 'blocked') {
        revokeUserSessions(id)
        setSessions(listSessions())
      }
      if (result.ok && before) {
        const name = staff.displayName(result.user)
        if (patch.status && patch.status !== before.status) audit(patch.status === 'blocked' ? 'staff.block' : 'staff.unblock', name, id)
        else {
          const roleChange = patch.role && patch.role !== before.role ? `: rol ${ROLE_LABELS[before.role]} → ${ROLE_LABELS[patch.role]}` : ''
          audit('staff.update', `${name}${roleChange}`, id)
        }
      }
      return fromResult(result)
    },
    resetPassword: async (id) => {
      if (!current || !session || !allowed('staff.manage')) return DENIED as { ok: false; error: string }
      const result = await staff.resetPassword(id)
      if (!result.ok) return result
      // Eski parol bilan ochilgan seanslar yopiladi (o'zining joriy seansi qoladi)
      revokeUserSessions(id, id === current.id ? session.id : undefined)
      audit('staff.password', staff.displayName(result.user), id)
      setUsers(result.users)
      setSessions(listSessions())
      return { ok: true, password: result.password }
    },
    sessions,
    revokeSession: (id) => {
      if (!session) return
      if (id === session.id) {
        endSession(session.id)
        setSession(null)
        setSessions(listSessions())
        return
      }
      const record = sessions.find((s) => s.id === id)
      const own = record?.userId === session.userId
      if (!own && !allowed('staff.manage')) return
      revokeSession(id)
      if (record) audit('session.revoke', `${nameOf(record.userId)} · ${record.device}`, record.userId)
      setSessions(listSessions())
    },
    revokeOtherSessions: () => {
      if (!session) return
      const count = sessions.filter((s) => s.id !== session.id && (allowed('staff.manage') || s.userId === session.userId)).length
      if (allowed('staff.manage')) revokeOtherSessions(session.id)
      else revokeUserSessions(session.userId, session.id)
      audit('session.revoke', `Boshqa ${count} ta seans yopildi`)
      setSessions(listSessions())
    },
    enterDemo: (role = 'admin') => {
      loadDemoData()
        .then((data) => {
          // Seans haqiqiy nom maydonida yopiladi, keyin demo'ga o'tiladi
          if (session) endSession(session.id)
          const demoStaff = openDemoWorkspace(data)
          const user = demoStaff.find((u) => u.role === role) ?? demoStaff[0]
          setMode('demo')
          setSubscription(loadSubscription())
          begin(user, demoStaff)
        })
        .catch(() => toast.error(tr('Demo yuklanmadi. Internetni tekshirib, qayta urinib ko\'ring.')))
    },
    exitDemo: leaveDemo,
    switchDemoRole: (role) => {
      if (mode !== 'demo' || !session) return
      const user = users.find((u) => u.role === role && u.status === 'active')
      if (!user || user.id === session.userId) return
      endSession(session.id)
      begin(user, users)
    },
  }

  return <AuthContext value={value}>{children}</AuthContext>
}
