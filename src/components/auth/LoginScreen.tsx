import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../constants/navigation'
import { useAuth } from '../../hooks/useAuth'
import { DEFAULT_LOGIN, DEFAULT_PASSWORD, isCryptoAvailable } from '../../services/auth.service'
import { Button, IconButton } from '../ui/Button'
import { Input } from '../ui/Input'

const MAX_ATTEMPTS = 5
const LOCK_MS = 30_000

export function LoginScreen() {
  const { login, usingDefaultPassword } = useAuth()
  const [form, setForm] = useState({ login: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const cryptoReady = isCryptoAvailable()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.login.trim() || !form.password) {
      setError('Login va parolni kiriting')
      return
    }
    if (Date.now() < lockedUntil) {
      setError('Juda ko\'p urinish. 30 soniyadan keyin qayta urinib ko\'ring')
      return
    }
    setBusy(true)
    const ok = await login(form.login, form.password)
    setBusy(false)
    if (ok) return
    const next = attempts + 1
    setAttempts(next)
    if (next >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCK_MS)
      setAttempts(0)
      setError('Juda ko\'p noto\'g\'ri urinish. 30 soniyadan keyin qayta urinib ko\'ring')
    } else {
      setError('Login yoki parol noto\'g\'ri')
    }
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

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="btn-block" disabled={busy || !cryptoReady}>
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
