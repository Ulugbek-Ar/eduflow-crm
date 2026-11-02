import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../constants/navigation'
import { useAuth } from '../../hooks/useAuth'
import { DEFAULT_LOGIN, DEFAULT_PASSWORD, isCryptoAvailable } from '../../services/auth.service'
import { formatLockWait, lockRemaining, MAX_ATTEMPTS, readLockState, registerFailure, registerSuccess } from '../../services/loginLock.service'
import { Button, IconButton } from '../ui/Button'
import { Input } from '../ui/Input'

export function LoginScreen() {
  const { login, usingDefaultPassword } = useAuth()
  const [form, setForm] = useState({ login: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
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
    document.title = 'Kirish · Apex Dashboard'
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
    const ok = await login(form.login, form.password)
    setBusy(false)
    if (ok) {
      registerSuccess()
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
      <form className="login-card" onSubmit={handleSubmit} noValidate aria-labelledby="login-title">
        <div className="login-brand">
          <span className="logo-mark">
            <Icon name="logo" size={22} />
          </span>
          <div>
            <h1 id="login-title">Apex Dashboard</h1>
            <p className="muted">Boshqaruv paneliga kirish</p>
          </div>
        </div>

        {!cryptoReady && (
          <p className="notice notice-error" role="alert">
            Brauzer xavfsiz kontekstda emas (HTTPS yoki localhost kerak) — kirish imkonsiz.
          </p>
        )}

        <Input
          label="Login"
          autoComplete="username"
          value={form.login}
          onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
          data-autofocus
          autoFocus
        />
        <div className="password-field">
          <Input
            label="Parol"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
          <IconButton
            icon={showPassword ? 'eye' : 'lock'}
            label={showPassword ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
            className="password-toggle"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          />
        </div>

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

        {usingDefaultPassword && (
          <p className="login-hint">
            Standart kirish: <code>{DEFAULT_LOGIN}</code> / <code>{DEFAULT_PASSWORD}</code>. Kirgandan so'ng parolni almashtiring.
          </p>
        )}
      </form>
    </main>
  )
}
