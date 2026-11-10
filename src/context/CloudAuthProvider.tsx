// Bulutli rejim (Supabase Auth + RLS): lokal AuthProvider bilan bir xil AuthContextValue beradi.
// Demo bu rejimda ham lokal (alohida nom maydonida) — demo'ga kirish/chiqishda sahifa qayta yuklanadi
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { can as roleCan, readOnlyAllows } from '../auth/permissions'
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
  // Oxirgi yuklash tarmoq xatosi bilan tugadi
  connectionError: boolean
}

type Loaded = Omit<CloudState, 'recovery'>

async function fetchCloudState(): Promise<Loaded> {
  try {
    await cloudApi.ensureOrganization().catch(() => undefined)
    const profile = await cloudApi.loadOwnProfile()
    if (!profile || profile.status !== 'active') return { loading: false, profile: null, staff: [], org: null, connectionError: false }
    const [staff, org] = await Promise.all([cloudApi.loadStaff(), cloudApi.loadOrganization()])
    return { loading: false, profile, staff, org, connectionError: false }
  } catch {
    // Internet yo'q yoki server javob bermadi: bu "chiqib ketish" emas — seans brauzerda saqlangan
    return { loading: false, profile: null, staff: [], org: null, connectionError: true }
  }
}

// Tarmoq xatosida avval kirgan foydalanuvchi holati saqlanadi (panel yopilib, kirish oynasi chiqmasin)
function merge(s: CloudState, next: Loaded): CloudState {
  if (next.connectionError && s.profile) return { ...s, loading: false, connectionError: true }
  return { ...s, ...next }
}

const message = (error: unknown) => (error instanceof Error ? error.message : tr('Tarmoq xatosi. Qayta urinib ko\'ring.'))
const MINUTE = 60_000

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [state, setState] = useState<CloudState>({ loading: true, profile: null, staff: [], org: null, recovery: false, connectionError: false })
  // Tarif muddati shu vaqtga qarab hisoblanadi — ochiq oynada ham har daqiqada yangilanadi
  const [now, setNow] = useState(Date.now)
  // Ketma-ket yuklashlar (kirish + SIGNED_IN hodisasi): faqat eng oxirgisining natijasi qo'llanadi
  const generation = useRef(0)

  // Serverdan qayta o'qish (kirish, chiqish, profil o'zgarishi)
  const refresh = () => {
    const gen = ++generation.current
    fetchCloudState().then((next) => gen === generation.current && setState((s) => merge(s, next)))
  }

  useEffect(() => {
    setAuditBackend({ log: (e) => cloudApi.logEvent(e.action, e.summary, e.entityId), list: cloudApi.listAudit })
    let alive = true
    const load = () => {
      const gen = ++generation.current
      fetchCloudState().then((next) => alive && gen === generation.current && setState((s) => merge(s, next)))
    }
    load()
    const { data } = cloudApi.getClient().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setState((s) => ({ ...s, recovery: true }))
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') load()
    })
    const tick = window.setInterval(() => setNow(Date.now()), MINUTE)
    return () => {
      alive = false
      data.subscription.unsubscribe()
      window.clearInterval(tick)
      setAuditBackend(null)
    }
  }, [])

  // Internet qaytdi — ulanish xatosi bo'lgan bo'lsa qayta yuklash
  const retryOnline = useEffectEvent(() => refresh())
  useEffect(() => {
    if (!state.connectionError) return
    const onOnline = () => retryOnline()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [state.connectionError])

  const { profile, staff, org } = state
  const access = computeAccess(org?.subscription ?? NO_SUBSCRIPTION, now)
  const allowed = (permission: Permission) => roleCan(profile?.role, permission) && (!access.readOnly || readOnlyAllows(permission))

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
      try {
        const created = await cloudApi.inviteStaff({ email: input.login, fullName: input.fullName, title: input.title, role: input.role, password: input.password, teacherId: input.teacherId })
        refresh()
        return { ok: true, userId: created.id }
      } catch (error) {
        return { ok: false, error: message(error) }
      }
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
      // Markaz sozlamalari ham har safar serverdan (boshqa xodim o'zgartirgan bo'lishi mumkin)
      loadSnapshot: async () => {
        if (!org) throw new Error(tr('Markaz topilmadi'))
        const fresh = await cloudApi.loadOrganization()
        return cloudApi.loadSnapshot(fresh ?? org, profile?.role)
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
      connectionError: state.connectionError,
      retry: () => {
        setState((s) => ({ ...s, loading: !s.profile }))
        refresh()
      },
    },
  }

  return <AuthContext value={value}>{children}</AuthContext>
}
