// Bulutli rejim (Supabase Auth + RLS): lokal AuthProvider bilan bir xil AuthContextValue beradi.
// Demo bu rejimda ham lokal (alohida nom maydonida) — demo'ga kirish/chiqishda sahifa qayta yuklanadi
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { can as roleCan } from '../auth/permissions'
import type { Permission } from '../auth/permissions'
import * as cloudApi from '../data/supabase'
import type { CloudOrg, CloudProfile } from '../data/supabase'
import { AuthContext } from '../hooks/useAuth'
import type { ActionResult, AuthContextValue } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { tr } from '../i18n'
import { setAuditBackend } from '../services/audit.service'
import { validatePassword } from '../services/auth.service'
import { openDemoWorkspace } from '../services/demo.service'
import { loadDemoData } from '../services/demo/load'
import { startSession } from '../services/sessions.service'
import { computeAccess } from '../services/subscription.service'
import type { Subscription } from '../services/subscription.service'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NO_SUBSCRIPTION: Subscription = { plan: 'trial', status: 'active', enforced: true }

interface CloudState {
  loading: boolean
  profile: CloudProfile | null
  staff: CloudProfile[]
  org: CloudOrg | null
  // Email'dagi "parolni tiklash" havolasi bilan kirildi — yangi parol majburiy
  recovery: boolean
}

async function fetchCloudState(): Promise<Omit<CloudState, 'recovery'>> {
  try {
    await cloudApi.ensureOrganization().catch(() => undefined)
    const profile = await cloudApi.loadOwnProfile()
    if (!profile || profile.status !== 'active') return { loading: false, profile: null, staff: [], org: null }
    const [staff, org] = await Promise.all([cloudApi.loadStaff(), cloudApi.loadOrganization()])
    return { loading: false, profile, staff, org }
  } catch {
    return { loading: false, profile: null, staff: [], org: null }
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : tr('Tarmoq xatosi. Qayta urinib ko\'ring.'))

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [state, setState] = useState<CloudState>({ loading: true, profile: null, staff: [], org: null, recovery: false })
  const [openedAt] = useState(Date.now)

  // Serverdan qayta o'qish (kirish, chiqish, profil o'zgarishi)
  const refresh = () => {
    fetchCloudState().then((next) => setState((s) => ({ ...s, ...next })))
  }

  useEffect(() => {
    setAuditBackend({ log: (e) => cloudApi.logEvent(e.action, e.summary, e.entityId), list: cloudApi.listAudit })
    let alive = true
    const load = () => fetchCloudState().then((next) => alive && setState((s) => ({ ...s, ...next })))
    load()
    const { data } = cloudApi.getClient().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setState((s) => ({ ...s, recovery: true }))
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') load()
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
      setAuditBackend(null)
    }
  }, [])

  const { profile, staff, org } = state
  const access = computeAccess(org?.subscription ?? NO_SUBSCRIPTION, openedAt)
  const allowed = (permission: Permission) => roleCan(profile?.role, permission) && (!access.readOnly || permission.endsWith('.view'))

  const run = async (action: () => Promise<unknown>, after = true): Promise<ActionResult> => {
    try {
      await action()
      if (after) refresh()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: message(error) }
    }
  }

  const value: AuthContextValue = {
    loading: state.loading,
    user: profile ? { ...profile, mustChange: profile.mustChange || state.recovery } : null,
    sessionId: profile ? 'cloud' : null,
    mode: 'main',
    needsSetup: false,
    can: allowed,
    subscription: org?.subscription ?? NO_SUBSCRIPTION,
    access,
    login: async (email, password) => {
      const result = await cloudApi.signIn(email, password)
      if (!result.ok) return { ok: false, reason: result.reason === 'blocked' ? 'blocked' : 'invalid' }
      refresh()
      return { ok: true }
    },
    logout: () => {
      cloudApi.signOut('local').finally(() => setState((s) => ({ ...s, profile: null, staff: [], org: null, recovery: false })))
    },
    setupAdmin: async () => ({ ok: false, error: tr('Bulutli rejimda ro\'yxatdan o\'tish email orqali') }),
    completePasswordChange: async (newPassword) => {
      const invalid = validatePassword(newPassword, profile?.login)
      if (invalid) return { ok: false, field: 'password', error: invalid }
      const result = await run(() => cloudApi.changePassword(newPassword))
      if (result.ok) setState((s) => ({ ...s, recovery: false }))
      return result.ok ? result : { ok: false, field: 'password', error: result.error }
    },
    changeOwnCredentials: async (currentPassword, newLogin, newPassword) => {
      if (!profile) return { ok: false, error: tr('Hisob topilmadi') }
      if (!(await cloudApi.verifyPassword(profile.login, currentPassword))) return { ok: false, field: 'current', error: tr('Joriy parol noto\'g\'ri') }
      const email = newLogin.trim().toLowerCase()
      if (!EMAIL.test(email)) return { ok: false, field: 'login', error: tr('Email noto\'g\'ri formatda') }
      if (newPassword) {
        const invalid = validatePassword(newPassword, email)
        if (invalid) return { ok: false, field: 'password', error: invalid }
      }
      return run(async () => {
        if (email !== profile.login) await cloudApi.changeEmail(email)
        if (newPassword) await cloudApi.changePassword(newPassword)
      })
    },
    updateOwnProfile: (fullName, title) => {
      if (fullName.trim().length < 2) return { ok: false, field: 'fullName', error: tr('Ism familiyani kiriting (kamida 2 ta harf)') }
      setState((s) => (s.profile ? { ...s, profile: { ...s.profile, fullName: fullName.trim(), title: title.trim() } } : s))
      run(() => cloudApi.updateOwnProfile(fullName, title)).then((r) => !r.ok && toast.error(r.error))
      return { ok: true }
    },
    users: staff,
    addUser: async (input) => {
      if (!allowed('staff.manage')) return { ok: false, error: tr('Bu amal uchun ruxsatingiz yo\'q') }
      if (!EMAIL.test(input.login.trim())) return { ok: false, field: 'login', error: tr('Bulutli rejimda login — xodimning emaili') }
      return run(() => cloudApi.inviteStaff({ email: input.login, fullName: input.fullName, title: input.title, role: input.role, password: input.password }))
    },
    updateUser: (id, patch) => {
      if (!allowed('staff.manage')) return { ok: false, error: tr('Bu amal uchun ruxsatingiz yo\'q') }
      if (id === profile?.id && (patch.status === 'blocked' || (patch.role && patch.role !== profile.role))) {
        return { ok: false, field: patch.status ? 'status' : 'role', error: tr('O\'z rolingizni o\'zgartira olmaysiz — buni boshqa administrator qiladi') }
      }
      setState((s) => ({ ...s, staff: s.staff.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
      run(() => cloudApi.updateStaff(id, patch)).then((r) => {
        if (!r.ok) {
          toast.error(r.error)
          refresh()
        }
      })
      return { ok: true }
    },
    resetPassword: async (id) => {
      try {
        const { password } = await cloudApi.resetStaffPassword(id)
        return { ok: true, password }
      } catch (error) {
        return { ok: false, error: message(error) }
      }
    },
    sessions: [],
    revokeSession: () => undefined,
    revokeOtherSessions: () => {
      cloudApi.signOut('others').catch((error) => toast.error(message(error)))
    },
    enterDemo: (role = 'admin') => {
      loadDemoData()
        .then((data) => {
          const demoStaff = openDemoWorkspace(data)
          startSession((demoStaff.find((u) => u.role === role) ?? demoStaff[0]).id)
          window.location.reload()
        })
        .catch(() => toast.error(tr('Demo yuklanmadi. Internetni tekshirib, qayta urinib ko\'ring.')))
    },
    exitDemo: () => undefined,
    switchDemoRole: () => undefined,
    cloud: {
      org,
      loadSnapshot: () => {
        if (!org) return Promise.reject(new Error(tr('Markaz topilmadi')))
        return cloudApi.loadSnapshot(org, profile?.role)
      },
      createSync: (snapshot) => new cloudApi.CloudSync(org?.id ?? '', snapshot.trash),
      signUp: async (input) => {
        try {
          const result = await cloudApi.signUp(input)
          if (result === 'ready') refresh()
          return { ok: true, confirmEmail: result === 'confirm-email' }
        } catch (error) {
          return { ok: false, error: message(error) }
        }
      },
      sendPasswordReset: (email) => run(() => cloudApi.sendPasswordReset(email), false),
      importLocal: (data) => run(() => cloudApi.importBackup(data), false),
    },
  }

  return <AuthContext value={value}>{children}</AuthContext>
}
