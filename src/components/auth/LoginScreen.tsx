import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../constants/navigation'
import { useAuth } from '../../hooks/useAuth'
import { isCryptoAvailable } from '../../services/auth.service'
import { formatLockWait, lockRemaining, MAX_ATTEMPTS, readLockState, registerFailure, registerSuccess } from '../../services/loginLock.service'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PasswordInput } from '../ui/PasswordInput'
import { APP_NAME, pageTitle } from '../../constants/app'

export function AuthBrand({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="login-brand">
      <span className="logo-mark">
        <Icon name="logo" size={22} />
      </span>
      <div>
        <h1 id="login-title">{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>
    </div>
  )
}

// Demo — alohida namunaviy markaz: haqiqiy ma'lumotga tegmaydi, chiqishda o'chadi
export function DemoEntry() {
  const { enterDemo } = useAuth()
  return (
    <div className="auth-demo">
      <span className="auth-divider">
        <span>yoki</span>
      </span>
      <Button variant="ghost" icon="play" className="btn-block" onClick={() => enterDemo()}>
        Demo'ni ko'rish
      </Button>
      <small className="muted">Namunaviy markaz ochiladi. Sizning ma'lumotingizga tegmaydi.</small>
    </div>
  )
}

export function LoginScreen() {
  const { login } = useAuth()
  const [form, setForm] = useState({ login: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Blok holati localStorage'dan: sahifa yangilansa ham saqlanadi
  const [lock, setLock] = useState(readLockState)
  const [now, setNow] = useState(Date.now)
  const cryptoReady = isCryptoAvailable()
  const remaining = lockRemaining(lock, now)
  const locked = remaining > 0

  // Blok davomida har soniyada qolgan vaqt yangilanadi
  useEffect(() => {
    if (!locked) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [locked])

  useEffect(() => {
    document.title = pageTitle('Kirish')
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.login.trim() || !form.password) {
      setError('Login va parolni kiriting')
      return
    }
    // Boshqa tabda blok boshlangan bo'lishi mumkin — har safar saqlangan holat o'qiladi
    const current = readLockState()
    setLock(current)
    setNow(Date.now())
    if (lockRemaining(current) > 0) return
    setBusy(true)
    const result = await login(form.login, form.password)
    setBusy(false)
    if (result.ok) {
      registerSuccess()
      return
    }
    if (result.reason === 'blocked') {
      registerSuccess()
      setError('Hisobingiz bloklangan. Administratorga murojaat qiling.')
      setForm((prev) => ({ ...prev, password: '' }))
      return
    }
    const next = registerFailure()
    setLock(next)
    setNow(Date.now())
    const left = MAX_ATTEMPTS - next.failures
    setError(lockRemaining(next) > 0 ? '' : `Login yoki parol noto'g'ri. Yana ${left} ta urinish qoldi`)
    setForm((prev) => ({ ...prev, password: '' }))
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <form className="auth-form" onSubmit={handleSubmit} noValidate aria-labelledby="login-title">
          <AuthBrand title={APP_NAME} subtitle="Boshqaruv paneliga kirish" />

          {!cryptoReady && (
            <p className="notice notice-error" role="alert">
              Brauzer xavfsiz kontekstda emas (HTTPS yoki localhost kerak) — kirish imkonsiz.
            </p>
          )}

          <Input
            label="Login"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.login}
            onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
            data-autofocus
            autoFocus
          />
          <PasswordInput
            label="Parol"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />

          {locked ? (
            <p className="notice notice-error" role="alert">
              Juda ko'p noto'g'ri urinish. Kirish vaqtincha bloklandi.{' '}
              <span aria-live="off">{formatLockWait(remaining)} dan keyin qayta urinib ko'ring.</span>
            </p>
          ) : (
            error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )
          )}

          <Button type="submit" className="btn-block" disabled={busy || !cryptoReady || locked}>
            {busy ? 'Tekshirilmoqda...' : 'Kirish'}
          </Button>

          <details className="auth-help">
            <summary>Parolni unutdingizmi?</summary>
            <p>
              Markaz administratoridan parolni tiklashni so'rang: <strong>Boshqaruv → Xodimlar → Parolni tiklash</strong>. U sizga
              vaqtinchalik parol beradi, kirgach o'zingiz yangisini o'rnatasiz.
            </p>
          </details>
        </form>
        <DemoEntry />
      </div>
    </main>
  )
}
