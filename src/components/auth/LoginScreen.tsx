import { tr } from '../../i18n'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../constants/navigation'
import { useAuth } from '../../hooks/useAuth'
import { isCryptoAvailable } from '../../services/auth.service'
import { formatLockWait, lockRemaining, MAX_ATTEMPTS, readLockState, registerFailure, registerSuccess } from '../../services/loginLock.service'
import { routeHref } from '../../router'
import { Button } from '../ui/Button'
import { LanguageSwitch } from '../ui/LanguageSwitch'
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
      <LanguageSwitch className="login-lang" />
    </div>
  )
}

// Demo — alohida namunaviy markaz: haqiqiy ma'lumotga tegmaydi, chiqishda o'chadi
export function DemoEntry() {
  const { enterDemo } = useAuth()
  return (
    <div className="auth-demo">
      <span className="auth-divider">
        <span>{tr('yoki')}</span>
      </span>
      <Button variant="ghost" icon="play" className="btn-block" onClick={() => enterDemo()}>
        {tr('Demo\'ni ko\'rish')}
      </Button>
      <small className="muted">{tr('Namunaviy markaz ochiladi. Sizning ma\'lumotingizga tegmaydi.')}</small>
      <a className="auth-home" href={routeHref('landing')}>
        ← {tr('Bosh sahifa')}
      </a>
    </div>
  )
}

// Bulutli rejimda: email bilan, parol tiklash havolasi emailga, ro'yxatdan o'tish (onSignUp)
function CloudReset({ initialEmail }: { initialEmail: string }) {
  const { cloud } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [notice, setNotice] = useState('')
  if (!cloud) return null
  return (
    <div className="form">
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          const result = await cloud.sendPasswordReset(email)
          setNotice(result.ok ? tr('Parolni tiklash havolasi emailingizga yuborildi.') : result.error)
        }}
      >
        {tr('Havolani yuborish')}
      </Button>
      {notice && <p role="status">{notice}</p>}
    </div>
  )
}

export function LoginScreen({ onSignUp }: { onSignUp?: () => void }) {
  const { login, cloud } = useAuth()
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
    document.title = pageTitle(tr('Kirish'))
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.login.trim() || !form.password) {
      setError(tr('Login va parolni kiriting'))
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
      setError(tr('Hisobingiz bloklangan. Administratorga murojaat qiling.'))
      setForm((prev) => ({ ...prev, password: '' }))
      return
    }
    const next = registerFailure()
    setLock(next)
    setNow(Date.now())
    const left = MAX_ATTEMPTS - next.failures
    setError(lockRemaining(next) > 0 ? '' : tr('Login yoki parol noto\'g\'ri. Yana {0} ta urinish qoldi', { 0: left }))
    setForm((prev) => ({ ...prev, password: '' }))
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <form className="auth-form" onSubmit={handleSubmit} noValidate aria-labelledby="login-title">
          <AuthBrand title={APP_NAME} subtitle={tr('Boshqaruv paneliga kirish')} />

          {!cryptoReady && (
            <p className="notice notice-error" role="alert">
              {tr('Brauzer xavfsiz kontekstda emas (HTTPS yoki localhost kerak) — kirish imkonsiz.')}
            </p>
          )}

          <Input
            label={cloud ? 'Email' : tr('Login')}
            type={cloud ? 'email' : 'text'}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.login}
            onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
            data-autofocus
            autoFocus
          />
          <PasswordInput
            label={tr('Parol')}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />

          {locked ? (
            <p className="notice notice-error" role="alert">
              {tr('Juda ko\'p noto\'g\'ri urinish. Kirish vaqtincha bloklandi.')}{' '}
              <span aria-live="off">{formatLockWait(remaining)} {tr('dan keyin qayta urinib ko\'ring.')}</span>
            </p>
          ) : (
            error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )
          )}

          <Button type="submit" className="btn-block" disabled={busy || !cryptoReady || locked}>
            {busy ? tr('Tekshirilmoqda...') : tr('Kirish')}
          </Button>

          <details className="auth-help">
            <summary>{tr('Parolni unutdingizmi?')}</summary>
            {cloud ? (
              <CloudReset initialEmail={form.login} />
            ) : (
              <p>
                {tr('Markaz administratoridan parolni tiklashni so\'rang:')} <strong>{tr('Boshqaruv → Xodimlar → Parolni tiklash')}</strong>{tr('. U sizga vaqtinchalik parol beradi, kirgach o\'zingiz yangisini o\'rnatasiz.')}
              </p>
            )}
          </details>
          {onSignUp && (
            <button type="button" className="link-btn auth-signup" onClick={onSignUp}>
              {tr('Markazingiz hali ro\'yxatdan o\'tmaganmi? Ro\'yxatdan o\'tish')}
            </button>
          )}
        </form>
        <DemoEntry />
      </div>
    </main>
  )
}
