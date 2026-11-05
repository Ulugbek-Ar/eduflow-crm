import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { pageTitle } from '../../constants/app'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { MIN_PASSWORD_LENGTH } from '../../services/auth.service'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PasswordInput } from '../ui/PasswordInput'
import { AuthBrand } from './LoginScreen'

// Vaqtinchalik parol (administrator bergan yoki eski standart parol) bilan kirilganda — davom etishdan oldin majburiy
export function ForcePasswordChange() {
  const { user, completePasswordChange, logout } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = pageTitle('Yangi parol')
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!form.password) next.password = 'Yangi parolni kiriting'
    else if (form.password !== form.confirm) next.confirm = 'Parollar mos kelmadi'
    setErrors(next)
    if (next.password) return passwordRef.current?.focus()
    if (next.confirm) return confirmRef.current?.focus()
    setBusy(true)
    const result = await completePasswordChange(form.password)
    setBusy(false)
    if (result.ok) {
      toast.success('Yangi parol o\'rnatildi')
      return
    }
    setErrors({ password: result.error })
    passwordRef.current?.focus()
  }

  return (
    <main className="login-page">
      <form className="login-card auth-form" onSubmit={handleSubmit} noValidate aria-labelledby="login-title">
        <AuthBrand title="Yangi parol o'rnating" subtitle={user ? `${user.fullName || user.login}, xush kelibsiz!` : ''} />
        <p className="notice notice-warning">
          Siz vaqtinchalik parol bilan kirdingiz. Davom etish uchun faqat o'zingiz biladigan yangi parol o'rnating.
        </p>
        <PasswordInput
          ref={passwordRef}
          label="Yangi parol"
          required
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          hint={`Kamida ${MIN_PASSWORD_LENGTH} ta belgi`}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, password: e.target.value }))
            setErrors({})
          }}
          autoFocus
        />
        <Input
          ref={confirmRef}
          type="password"
          label="Parolni takrorlang"
          required
          autoComplete="new-password"
          value={form.confirm}
          error={errors.confirm}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, confirm: e.target.value }))
            setErrors((prev) => ({ ...prev, confirm: undefined }))
          }}
        />
        <Button type="submit" className="btn-block" icon="lock" disabled={busy}>
          {busy ? 'Saqlanmoqda...' : 'Saqlash va davom etish'}
        </Button>
        <Button variant="ghost" className="btn-block" onClick={logout}>
          Chiqish
        </Button>
      </form>
    </main>
  )
}
