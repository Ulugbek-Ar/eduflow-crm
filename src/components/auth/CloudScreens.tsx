import { useEffect, useEffectEvent, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { DashboardProvider } from '../../context/DashboardContext'
import type { CloudBinding } from '../../context/DashboardContext'
import type { CloudAuthExtras } from '../../hooks/useAuth'
import { tr } from '../../i18n'
import { routeHref } from '../../router'
import { MIN_PASSWORD_LENGTH, validatePassword } from '../../services/auth.service'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PasswordInput } from '../ui/PasswordInput'
import { AuthBrand } from './LoginScreen'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CloudLoading({ text = tr('Yuklanmoqda...') }: { text?: string }) {
  return (
    <main className="login-page">
      <div className="section-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        {text}
      </div>
    </main>
  )
}

// Serverga ulanib bo'lmadi: seans saqlangan, kirish oynasi ko'rsatilmaydi — internet qaytsa o'zi qayta urinadi
export function CloudConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="login-page">
      <div className="login-card auth-form" role="alert">
        <h1>{tr('Serverga ulanib bo\'lmadi')}</h1>
        <p className="muted">
          {tr('Internet aloqasini tekshiring. Hisobingizdan chiqilmagan — aloqa tiklangach ma\'lumotlaringiz o\'zi ochiladi.')}
        </p>
        <Button icon="refresh" onClick={onRetry}>
          {tr('Qayta urinish')}
        </Button>
      </div>
    </main>
  )
}

// Bulutli rejimda ro'yxatdan o'tish: email + parol, markaz 14 kunlik sinov bilan yaratiladi
export function CloudSignUpScreen({ cloud, onBack }: { cloud: CloudAuthExtras; onBack: () => void }) {
  const [form, setForm] = useState({ orgName: '', fullName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({})
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (form.orgName.trim().length < 2) next.orgName = tr('Markaz nomini kiriting')
    if (form.fullName.trim().length < 2) next.fullName = tr('Ism familiyani kiriting (kamida 2 ta harf)')
    if (!EMAIL.test(form.email.trim())) next.email = tr('Email noto\'g\'ri formatda')
    const passwordError = validatePassword(form.password, form.email)
    if (passwordError) next.password = passwordError
    else if (form.password !== form.confirm) next.confirm = tr('Parollar mos kelmadi')
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    setBusy(true)
    const result = await cloud.signUp({ email: form.email, password: form.password, orgName: form.orgName.trim(), fullName: form.fullName.trim(), title: tr('Direktor') })
    setBusy(false)
    if (!result.ok) setNotice(result.error)
    else if (result.confirmEmail) setNotice(tr('Emailingizga tasdiqlash havolasi yuborildi. Havolani bosing — markazingiz tayyor bo\'ladi.'))
  }

  return (
    <main className="login-page">
      <div className="login-card login-card-wide">
        <form className="auth-form" onSubmit={submit} noValidate aria-labelledby="login-title">
          <AuthBrand title={tr('Markazni ro\'yxatdan o\'tkazish')} subtitle={tr('14 kun bepul · bulutda saqlanadi')} />
          <Input label={tr('O\'quv markazi nomi')} required value={form.orgName} error={errors.orgName} onChange={(e) => set('orgName', e.target.value)} autoFocus />
          <Input label={tr('Ism familiyangiz')} required autoComplete="name" value={form.fullName} error={errors.fullName} onChange={(e) => set('fullName', e.target.value)} />
          <Input label="Email" type="email" required autoComplete="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
          <div className="form-row">
            <PasswordInput
              label={tr('Parol')}
              required
              autoComplete="new-password"
              value={form.password}
              error={errors.password}
              hint={tr('Kamida {0} ta belgi', { 0: MIN_PASSWORD_LENGTH })}
              onChange={(e) => set('password', e.target.value)}
            />
            <Input label={tr('Parolni takrorlang')} type="password" required autoComplete="new-password" value={form.confirm} error={errors.confirm} onChange={(e) => set('confirm', e.target.value)} />
          </div>
          {notice && (
            <p className="notice notice-info" role="status">
              {notice}
            </p>
          )}
          <Button type="submit" className="btn-block" disabled={busy}>
            {busy ? tr('Yaratilmoqda...') : tr('Hisob yaratish')}
          </Button>
          <p className="login-hint">
            {tr('Hisob yaratib, siz rozilik bildirasiz:')} <a href={routeHref('terms')}>{tr('Foydalanish shartlari')}</a>,{' '}
            <a href={routeHref('privacy')}>{tr('Maxfiylik siyosati')}</a>
          </p>
          <button type="button" className="link-btn" onClick={onBack}>
            {tr('Hisobim bor — kirish')}
          </button>
        </form>
      </div>
    </main>
  )
}

// Markaz ma'lumoti serverdan yuklangach panel ochiladi; xato bo'lsa — qayta urinish
export function CloudDataGate({ cloud, children }: { cloud: CloudAuthExtras; children: ReactNode }) {
  const [binding, setBinding] = useState<CloudBinding | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  // Markaz o'zgarmasa qayta yuklanmaydi (profil yoki xodimlar yangilanganda `cloud` obyekti yangilanadi)
  const orgId = cloud.org?.id
  const load = useEffectEvent((isAlive: () => boolean) => {
    cloud
      .loadSnapshot()
      .then((snapshot) => isAlive() && setBinding({ initial: snapshot, sync: cloud.createSync(snapshot), reload: () => cloud.loadSnapshot() }))
      .catch((e: unknown) => isAlive() && setError(e instanceof Error ? e.message : String(e)))
  })
  useEffect(() => {
    let alive = true
    load(() => alive)
    return () => {
      alive = false
    }
  }, [orgId, attempt])

  if (error) {
    return (
      <main className="login-page">
        <div className="login-card auth-form" role="alert">
          <h1>{tr('Ma\'lumotni yuklab bo\'lmadi')}</h1>
          <p className="muted">{tr('Internet aloqasini tekshiring va qayta urinib ko\'ring.')}</p>
          <small className="muted">{error}</small>
          <Button
            icon="refresh"
            onClick={() => {
              setError('')
              setAttempt((n) => n + 1)
            }}
          >
            {tr('Qayta urinish')}
          </Button>
        </div>
      </main>
    )
  }
  if (!binding) return <CloudLoading text={tr('Markaz ma\'lumotlari yuklanmoqda...')} />
  return <DashboardProvider cloud={binding}>{children}</DashboardProvider>
}
