import { tr } from '../../i18n'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { MIN_PASSWORD_LENGTH } from '../../services/auth.service'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PasswordInput } from '../ui/PasswordInput'

type Field = 'current' | 'login' | 'password' | 'confirm'
const ORDER: readonly Field[] = ['current', 'login', 'password', 'confirm']

export function SecuritySettings() {
  const { user, changeOwnCredentials, sessions, sessionId, revokeOtherSessions, mode } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', login: user?.login ?? '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const otherSessions = sessions.filter((s) => s.userId === user?.id && s.id !== sessionId).length

  const focus = (field: Field) => formRef.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus()

  const update = (key: Field, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: Partial<Record<Field, string>> = {}
    const loginChanged = form.login.trim() !== user?.login
    if (!form.current) next.current = tr('Joriy parolni kiriting')
    if (!loginChanged && !form.password) next.password = tr('Yangi parol yoki yangi login kiriting')
    if (form.password && form.password.length < MIN_PASSWORD_LENGTH) next.password = tr('Kamida {0} ta belgi', { 0: MIN_PASSWORD_LENGTH })
    if (form.password && form.password !== form.confirm) next.confirm = tr('Parollar mos kelmadi')
    setErrors(next)
    const first = ORDER.find((f) => next[f])
    if (first) return focus(first)

    setBusy(true)
    const result = await changeOwnCredentials(form.current, form.login.trim(), form.password)
    setBusy(false)
    if (!result.ok) {
      const field = result.field && (ORDER as readonly string[]).includes(result.field) ? (result.field as Field) : 'current'
      setErrors({ [field]: result.error })
      focus(field)
      return
    }
    setForm({ current: '', login: form.login.trim(), password: '', confirm: '' })
    toast.success(form.password ? tr('Parol muvaffaqiyatli almashtirildi') : tr('Login yangilandi'))
  }

  if (mode === 'demo') {
    return <p className="notice notice-warning">{tr('Demo rejimda login va parol o\'zgartirilmaydi.')}</p>
  }

  return (
    <form ref={formRef} className="form" onSubmit={handleSubmit} noValidate>
      <PasswordInput
        name="current"
        label={tr('Joriy parol')}
        autoComplete="current-password"
        required
        value={form.current}
        error={errors.current}
        onChange={(e) => update('current', e.target.value)}
      />
      <Input
        name="login"
        label={tr('Login')}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={form.login}
        error={errors.login}
        hint={tr('3–32 belgi: lotin harflari, raqam, _ . -')}
        onChange={(e) => update('login', e.target.value)}
      />
      <div className="form-row">
        <Input
          name="password"
          label={tr('Yangi parol')}
          type="password"
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          hint={tr('Kamida {0} ta belgi', { 0: MIN_PASSWORD_LENGTH })}
          onChange={(e) => update('password', e.target.value)}
        />
        <Input
          name="confirm"
          label={tr('Parolni tasdiqlang')}
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          error={errors.confirm}
          onChange={(e) => update('confirm', e.target.value)}
        />
      </div>
      <div className="form-actions">
        {otherSessions > 0 && (
          <Button
            variant="ghost"
            icon="logout"
            onClick={() => {
              revokeOtherSessions()
              toast.success(tr('Boshqa seanslar yopildi'))
            }}
          >
            {tr('Boshqa seanslarni yopish (')}{otherSessions})
          </Button>
        )}
        <Button type="submit" icon="lock" disabled={busy}>
          {busy ? tr('Saqlanmoqda...') : tr('Yangilash')}
        </Button>
      </div>
    </form>
  )
}
