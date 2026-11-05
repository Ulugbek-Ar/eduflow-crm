import { useEffect, useEffectEvent, useState } from 'react'
import type { ReactNode } from 'react'
import { can as roleCan } from '../auth/permissions'
import type { Permission } from '../auth/permissions'
import { AuthContext } from '../hooks/useAuth'
import type { ActionResult, AuthContextValue } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { closeDemoWorkspace, openDemoWorkspace } from '../services/demo.service'
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

const DENIED: ActionResult = { ok: false, error: 'Bu amal uchun ruxsatingiz yo\'q' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [initial] = useState(initialAuthState)
  const [mode, setMode] = useState(initial.mode)
  const [users, setUsers] = useState(initial.users)
  const [session, setSession] = useState(initial.session)
  const [sessions, setSessions] = useState(initial.sessions)

  const current = session ? users.find((u) => u.id === session.userId && u.status === 'active') : undefined
  const allowed = (permission: Permission) => roleCan(current?.role, permission)

  const leaveDemo = () => {
    if (session) endSession(session.id)
    closeDemoWorkspace()
    setMode('main')
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
    toast.info(user?.status === 'blocked' ? 'Hisobingiz bloklandi. Administratorga murojaat qiling.' : 'Seansingiz yopildi. Qaytadan kiring.')
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
    login: async (login, password) => {
      const result = await staff.authenticate(login, password)
      if (!result.ok) return result
      begin(result.user, result.users)
      return { ok: true }
    },
    logout: () => {
      if (mode === 'demo') return leaveDemo()
      if (session) endSession(session.id)
      setSession(null)
      setSessions(listSessions())
    },
    setupAdmin: async (input) => {
      const result = await staff.createFirstAdmin(input)
      if (!result.ok) return result
      begin(result.user, result.users)
      return { ok: true }
    },
    completePasswordChange: async (newPassword) => {
      if (!current) return DENIED
      return fromResult(await staff.completePasswordChange(current.id, newPassword))
    },
    changeOwnCredentials: async (currentPassword, newLogin, newPassword) => {
      if (!current) return DENIED
      return fromResult(await staff.changeOwnCredentials(current.id, currentPassword, newLogin, newPassword))
    },
    updateOwnProfile: (fullName, title) => {
      if (!current) return DENIED
      return fromResult(staff.updateOwnProfile(current.id, fullName, title))
    },
    users: users.map(staff.toPublicUser),
    addUser: async (input) => {
      if (!allowed('staff.manage')) return DENIED
      return fromResult(await staff.addUser(input))
    },
    updateUser: (id, patch) => {
      if (!current || !allowed('staff.manage')) return DENIED
      const result = staff.updateUser(current.id, id, patch)
      if (result.ok && patch.status === 'blocked') {
        revokeUserSessions(id)
        setSessions(listSessions())
      }
      return fromResult(result)
    },
    resetPassword: async (id) => {
      if (!current || !session || !allowed('staff.manage')) return DENIED as { ok: false; error: string }
      const result = await staff.resetPassword(id)
      if (!result.ok) return result
      // Eski parol bilan ochilgan seanslar yopiladi (o'zining joriy seansi qoladi)
      revokeUserSessions(id, id === current.id ? session.id : undefined)
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
      const own = sessions.some((s) => s.id === id && s.userId === session.userId)
      if (!own && !allowed('staff.manage')) return
      revokeSession(id)
      setSessions(listSessions())
    },
    revokeOtherSessions: () => {
      if (!session) return
      if (allowed('staff.manage')) revokeOtherSessions(session.id)
      else revokeUserSessions(session.userId, session.id)
      setSessions(listSessions())
    },
    enterDemo: (role = 'admin') => {
      if (session) endSession(session.id)
      const demoStaff = openDemoWorkspace()
      const user = demoStaff.find((u) => u.role === role) ?? demoStaff[0]
      setMode('demo')
      begin(user, demoStaff)
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
