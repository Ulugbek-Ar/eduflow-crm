import { useState } from 'react'
import type { FormEvent } from 'react'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from '../../auth/permissions'
import { useAuth } from '../../hooks/useAuth'
import { generateTempPassword } from '../../services/auth.service'
import type { PublicUser, Role } from '../../types/user.types'
import { cx } from '../../utils/cx'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { CopyField } from './TempPasswordModal'

type Field = 'fullName' | 'title' | 'login' | 'password'

interface StaffFormModalProps {
  // Bo'lmasa — yangi xodim
  editing?: PublicUser
  onClose: () => void
  onCreated?: (user: { fullName: string; login: string; password: string }) => void
}

export function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <fieldset className="role-picker" disabled={disabled}>
      <legend>Rol</legend>
      {ROLES.map((role) => (
        <label key={role} className={cx('role-option', value === role && 'is-active')}>
          <input type="radio" name="role" value={role} checked={value === role} onChange={() => onChange(role)} />
          <span>
            <strong>{ROLE_LABELS[role]}</strong>
            <small>{ROLE_DESCRIPTIONS[role]}</small>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function StaffFormModal({ editing, onClose, onCreated }: StaffFormModalProps) {
  const { addUser, updateUser, user: me } = useAuth()
  const [form, setForm] = useState(() => ({
    fullName: editing?.fullName ?? '',
    title: editing?.title ?? '',
    login: editing?.login ?? '',
    role: editing?.role ?? ('manager' as Role),
    password: editing ? '' : generateTempPassword(),
  }))
  const [errors, setErrors] = useState<Partial<Record<Field | 'role', string>>>({})
  const [busy, setBusy] = useState(false)
  const self = editing?.id === me?.id

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const result = editing
      ? updateUser(editing.id, { fullName: form.fullName, title: form.title, role: form.role })
      : await addUser({ fullName: form.fullName, title: form.title, login: form.login, role: form.role, password: form.password })
    setBusy(false)
    if (!result.ok) {
      const field = result.field ?? 'fullName'
      setErrors({ [field]: result.error })
      document.querySelector<HTMLElement>(`#staff-form [name="${field}"]`)?.focus()
      return
    }
    if (!editing) onCreated?.({ fullName: form.fullName.trim(), login: form.login.trim(), password: form.password })
    onClose()
  }

  return (
    <Modal
      title={editing ? 'Xodimni tahrirlash' : 'Yangi xodim'}
      description={editing ? undefined : 'Xodim shu login va vaqtinchalik parol bilan kiradi, so\'ng o\'z parolini o\'rnatadi'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="staff-form" icon="check" disabled={busy}>
            {editing ? 'Saqlash' : 'Qo\'shish'}
          </Button>
        </>
      }
    >
      <form id="staff-form" className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <Input
            name="fullName"
            label="Ism familiya"
            required
            value={form.fullName}
            error={errors.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            data-autofocus
          />
          <Input
            name="title"
            label="Lavozim"
            value={form.title}
            error={errors.title}
            placeholder="Masalan: Administrator"
            onChange={(e) => update('title', e.target.value)}
          />
        </div>
        {!editing && (
          <div className="form-row">
            <Input
              name="login"
              label="Login"
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={form.login}
              error={errors.login}
              hint="Masalan: malika yoki m.yusupova"
              onChange={(e) => update('login', e.target.value)}
            />
            <div className="field">
              <CopyField
                label="Vaqtinchalik parol"
                value={form.password}
                error={errors.password}
                onRegenerate={() => update('password', generateTempPassword())}
              />
            </div>
          </div>
        )}
        <RolePicker value={form.role} onChange={(role) => update('role', role)} disabled={self} />
        {self && <small className="field-hint">O'z rolingizni boshqa administrator o'zgartiradi.</small>}
        {errors.role && (
          <small className="field-error" role="alert">
            {errors.role}
          </small>
        )}
      </form>
    </Modal>
  )
}
