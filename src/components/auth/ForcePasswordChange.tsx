import { tr } from '../../i18n'
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
    document.title = pageTitle(tr('Yangi parol'))
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!form.password) next.password = tr('Yangi parolni kiriting')
    else if (form.password !== form.confirm) next.confirm = tr('Parollar mos kelmadi')
    setErrors(next)
    if (next.password) return passwordRef.current?.focus()
    if (next.confirm) return confirmRef.current?.focus()
    setBusy(true)
    const result = await completePasswordChange(form.password)
    setBusy(false)
    if (result.ok) {
      toast.success(tr('Yangi parol o\'rnatildi'))
      return
    }
    setErrors({ password: result.error })
    passwordRef.current?.focus()
  }

  return (
    <main className="login-page">
      <form className="login-card auth-form" onSubmit={handleSubmit} noValidate aria-labelledby="login-title">
        <AuthBrand title={tr('Yangi parol o\'rnating')} subtitle={user ? tr('{0}, xush kelibsiz!', { 0: user.fullName || user.login }) : ''} />
        <p className="notice notice-warning">
          {tr('Siz vaqtinchalik parol bilan kirdingiz. Davom etish uchun faqat o\'zingiz biladigan yangi parol o\'rnating.')}
        </p>
        <PasswordInput
          ref={passwordRef}
          label={tr('Yangi parol')}
          required
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          hint={tr('Kamida {0} ta belgi', { 0: MIN_PASSWORD_LENGTH })}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, password: e.target.value }))
            setErrors({})
          }}
          autoFocus
        />
        <Input
          ref={confirmRef}
          type="password"
          label={tr('Parolni takrorlang')}
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
          {busy ? tr('Saqlanmoqda...') : tr('Saqlash va davom etish')}
        </Button>
        <Button variant="ghost" className="btn-block" onClick={logout}>
          {tr('Chiqish')}
        </Button>
      </form>
    </main>
  )
}
