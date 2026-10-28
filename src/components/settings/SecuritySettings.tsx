import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { MIN_PASSWORD_LENGTH } from '../../services/auth.service'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

type Field = 'current' | 'login' | 'password' | 'confirm'

export function SecuritySettings() {
  const { session, usingDefaultPassword, changeCredentials } = useAuth()
  const { settings, updateSettings } = useDashboard()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', login: session?.login ?? '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [busy, setBusy] = useState(false)
  const currentRef = useRef<HTMLInputElement>(null)
  const loginRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const update = (key: Field, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const focus = (field: Field) => {
    const refs = { current: currentRef, login: loginRef, password: passwordRef, confirm: confirmRef }
    refs[field].current?.focus()
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: Partial<Record<Field, string>> = {}
    const loginChanged = form.login.trim() !== session?.login
    if (!form.current) next.current = 'Joriy parolni kiriting'
    if (!loginChanged && !form.password) next.password = 'Yangi parol yoki yangi login kiriting'
    if (form.password && form.password.length < MIN_PASSWORD_LENGTH) next.password = `Kamida ${MIN_PASSWORD_LENGTH} ta belgi`
    if (form.password && form.password !== form.confirm) next.confirm = 'Parollar mos kelmadi'
    setErrors(next)
    const first = (['current', 'login', 'password', 'confirm'] as const).find((f) => next[f])
    if (first) return focus(first)

    setBusy(true)
    const result = await changeCredentials(form.current, form.login.trim(), form.password)
    setBusy(false)
    if (!result.ok) {
      setErrors({ [result.field]: result.error })
      focus(result.field)
      return
    }
    if (settings.adminLogin !== result.credentials.login) {
      updateSettings({ ...settings, adminLogin: result.credentials.login }, { silent: true })
    }
    setForm({ current: '', login: result.credentials.login, password: '', confirm: '' })
    toast.success(form.password ? 'Parol muvaffaqiyatli almashtirildi' : 'Login yangilandi')
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {usingDefaultPassword && (
        <p className="notice notice-warning" role="status">
          Standart parol ishlatilmoqda. Iltimos, uni hoziroq almashtiring.
        </p>
      )}
      <Input
        ref={currentRef}
        label="Joriy parol"
        type="password"
        autoComplete="current-password"
        required
        value={form.current}
        error={errors.current}
        onChange={(e) => update('current', e.target.value)}
      />
      <Input
        ref={loginRef}
        label="Login"
        autoComplete="username"
        value={form.login}
        error={errors.login}
        hint="3–32 belgi: lotin harflari, raqam, _ . -"
        onChange={(e) => update('login', e.target.value)}
      />
      <div className="form-row">
        <Input
          ref={passwordRef}
          label="Yangi parol"
          type="password"
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          hint={`Kamida ${MIN_PASSWORD_LENGTH} ta belgi`}
          onChange={(e) => update('password', e.target.value)}
        />
        <Input
          ref={confirmRef}
          label="Parolni tasdiqlang"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          error={errors.confirm}
          onChange={(e) => update('confirm', e.target.value)}
        />
      </div>
      <div className="form-actions">
        <Button type="submit" icon="lock" disabled={busy}>
          {busy ? 'Saqlanmoqda...' : 'Yangilash'}
        </Button>
      </div>
    </form>
  )
}
