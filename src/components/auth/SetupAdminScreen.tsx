import { tr } from '../../i18n'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { pageTitle } from '../../constants/app'
import { useAuth } from '../../hooks/useAuth'
import { isCryptoAvailable, MIN_PASSWORD_LENGTH } from '../../services/auth.service'
import { updateStoredSettings } from '../../services/storage.service'
import { getInitials } from '../../utils/customers'
import { routeHref } from '../../router'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PasswordInput } from '../ui/PasswordInput'
import { AuthBrand, DemoEntry } from './LoginScreen'

type Field = 'orgName' | 'fullName' | 'title' | 'login' | 'password' | 'confirm'
const ORDER: readonly Field[] = ['orgName', 'fullName', 'title', 'login', 'password', 'confirm']

// Birinchi ishga tushish: hali xodim yo'q. Standart parol yo'q — markaz egasi hisobni o'zi yaratadi
export function SetupAdminScreen() {
  const { setupAdmin } = useAuth()
  const [form, setForm] = useState<Record<Field, string>>({ orgName: '', fullName: '', title: tr('Direktor'), login: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const cryptoReady = isCryptoAvailable()

  useEffect(() => {
    document.title = pageTitle(tr('Ro\'yxatdan o\'tish'))
  }, [])

  const update = (key: Field, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const focus = (field: Field) => formRef.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: Partial<Record<Field, string>> = {}
    if (form.orgName.trim().length < 2) next.orgName = tr('Markaz nomini kiriting')
    if (form.password && form.password !== form.confirm) next.confirm = tr('Parollar mos kelmadi')
    if (!form.confirm) next.confirm = tr('Parolni yana bir marta yozing')
    setErrors(next)
    setFormError('')
    const first = ORDER.find((f) => next[f])
    if (first) return focus(first)

    setBusy(true)
    // Logo harflari markaz nomidan: "Bilim Plus" -> "BP" (keyin Sozlamalarda o'zgartiriladi)
    updateStoredSettings({ orgName: form.orgName.trim(), logoText: getInitials(form.orgName).slice(0, 3) })
    const result = await setupAdmin({ fullName: form.fullName, title: form.title, login: form.login, password: form.password })
    setBusy(false)
    if (result.ok) return
    if (result.field && (ORDER as readonly string[]).includes(result.field)) {
      setErrors({ [result.field]: result.error })
      focus(result.field as Field)
    } else {
      setFormError(result.error)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card login-card-wide">
        <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate aria-labelledby="login-title">
          <AuthBrand title={tr('Markazni ro\'yxatdan o\'tkazish')} subtitle={tr('Administrator hisobi — xodimlarni keyin o\'zingiz qo\'shasiz')} />

          {!cryptoReady && (
            <p className="notice notice-error" role="alert">
              {tr('Brauzer xavfsiz kontekstda emas (HTTPS yoki localhost kerak) — hisob yaratib bo\'lmaydi.')}
            </p>
          )}

          <Input
            name="orgName"
            label={tr('O\'quv markazi nomi')}
            required
            value={form.orgName}
            error={errors.orgName}
            placeholder={tr('Masalan: Bilim Plus')}
            onChange={(e) => update('orgName', e.target.value)}
            autoFocus
          />
          <div className="form-row">
            <Input
              name="fullName"
              label={tr('Ism familiyangiz')}
              required
              autoComplete="name"
              value={form.fullName}
              error={errors.fullName}
              onChange={(e) => update('fullName', e.target.value)}
            />
            <Input name="title" label={tr('Lavozim')} value={form.title} error={errors.title} onChange={(e) => update('title', e.target.value)} />
          </div>
          <Input
            name="login"
            label={tr('Login')}
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.login}
            error={errors.login}
            hint={tr('Kirish uchun: lotin harflari, raqam, _ . - (3–32 belgi)')}
            onChange={(e) => update('login', e.target.value)}
          />
          <div className="form-row">
            <PasswordInput
              name="password"
              label={tr('Parol')}
              required
              autoComplete="new-password"
              value={form.password}
              error={errors.password}
              hint={tr('Kamida {0} ta belgi', { 0: MIN_PASSWORD_LENGTH })}
              onChange={(e) => update('password', e.target.value)}
            />
            <Input
              name="confirm"
              type="password"
              label={tr('Parolni takrorlang')}
              required
              autoComplete="new-password"
              value={form.confirm}
              error={errors.confirm}
              onChange={(e) => update('confirm', e.target.value)}
            />
          </div>

          {formError && (
            <p className="notice notice-error" role="alert">
              {formError}
            </p>
          )}

          <Button type="submit" className="btn-block" disabled={busy || !cryptoReady}>
            {busy ? tr('Yaratilmoqda...') : tr('Hisob yaratish')}
          </Button>
          <p className="login-hint">{tr('Ma\'lumotlar shu brauzerda saqlanadi. Muntazam zaxira olishni unutmang.')}</p>
          <p className="login-hint">
            {tr('Hisob yaratib, siz rozilik bildirasiz:')} <a href={routeHref('terms')}>{tr('Foydalanish shartlari')}</a>,{' '}
            <a href={routeHref('privacy')}>{tr('Maxfiylik siyosati')}</a>
          </p>
        </form>
        <DemoEntry />
      </div>
    </main>
  )
}
