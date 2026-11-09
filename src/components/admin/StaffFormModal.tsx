import { tr } from '../../i18n'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from '../../auth/permissions'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { generateTempPassword } from '../../services/auth.service'
import type { PublicUser, Role } from '../../types/user.types'
import { cx } from '../../utils/cx'
import { BranchSelect } from '../branches/BranchSelect'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { CopyField } from './TempPasswordModal'

type Field = 'fullName' | 'title' | 'login' | 'password' | 'branch'

interface StaffFormModalProps {
  // Bo'lmasa — yangi xodim
  editing?: PublicUser
  onClose: () => void
  onCreated?: (user: { fullName: string; login: string; password: string; id?: string }) => void
  // O'qituvchiga kirish yaratish: ism tayyor, rol — o'qituvchi (o'zgartirilmaydi)
  preset?: { fullName: string; title: string; teacherId: string }
}

export function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <fieldset className="role-picker" disabled={disabled}>
      <legend>{tr('Rol')}</legend>
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

export function StaffFormModal({ editing, onClose, onCreated, preset }: StaffFormModalProps) {
  const { addUser, updateUser, user: me } = useAuth()
  const { branches } = useDashboard()
  const [form, setForm] = useState(() => ({
    // '' — butun markaz; filialga cheklangan administrator xodimni faqat o'z filialiga qo'shadi
    branchId: editing ? (editing.branchId ?? '') : (me?.branchId ?? ''),
    fullName: editing?.fullName ?? preset?.fullName ?? '',
    title: editing?.title ?? preset?.title ?? '',
    login: editing?.login ?? '',
    role: editing?.role ?? (preset ? 'teacher' : ('manager' as Role)),
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
    const branchChanged = branches.length > 0 && form.branchId !== (editing?.branchId ?? '')
    const result = editing
      ? updateUser(editing.id, { fullName: form.fullName, title: form.title, role: form.role, ...(branchChanged ? { branchId: form.branchId } : {}) })
      : await addUser({
          fullName: form.fullName,
          title: form.title,
          login: form.login,
          role: form.role,
          password: form.password,
          teacherId: preset?.teacherId,
          ...(form.branchId ? { branchId: form.branchId } : {}),
        })
    setBusy(false)
    if (!result.ok) {
      const field = result.field ?? 'fullName'
      setErrors({ [field]: result.error })
      document.querySelector<HTMLElement>(`#staff-form [name="${field}"]`)?.focus()
      return
    }
    if (!editing) onCreated?.({ fullName: form.fullName.trim(), login: form.login.trim(), password: form.password, id: 'userId' in result && typeof result.userId === 'string' ? result.userId : undefined })
    onClose()
  }

  return (
    <Modal
      title={editing ? tr('Xodimni tahrirlash') : preset ? tr('O\'qituvchiga kirish yaratish') : tr('Yangi xodim')}
      description={editing ? undefined : tr('Xodim shu login va vaqtinchalik parol bilan kiradi, so\'ng o\'z parolini o\'rnatadi')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tr('Bekor qilish')}
          </Button>
          <Button type="submit" form="staff-form" icon="check" disabled={busy}>
            {editing ? tr('Saqlash') : tr('Qo\'shish')}
          </Button>
        </>
      }
    >
      <form id="staff-form" className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <Input
            name="fullName"
            label={tr('Ism familiya')}
            required
            value={form.fullName}
            error={errors.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            data-autofocus
          />
          <Input
            name="title"
            label={tr('Lavozim')}
            value={form.title}
            error={errors.title}
            placeholder={tr('Masalan: Administrator')}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>
        {!editing && (
          <div className="form-row">
            <Input
              name="login"
              label={tr('Login')}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={form.login}
              error={errors.login}
              hint={tr('Masalan: malika yoki m.yusupova')}
              onChange={(e) => update('login', e.target.value)}
            />
            <div className="field">
              <CopyField
                label={tr('Vaqtinchalik parol')}
                value={form.password}
                error={errors.password}
                onRegenerate={() => update('password', generateTempPassword())}
              />
            </div>
          </div>
        )}
        {!self && (
          <BranchSelect
            value={form.branchId}
            noneLabel={tr('Barcha filiallar')}
            error={errors.branch}
            hint={form.branchId ? tr('Xodim faqat shu filial guruhlari, o\'quvchilari va to\'lovlarini ko\'radi') : tr('Xodim butun markazni ko\'radi')}
            onChange={(v) => update('branchId', v)}
          />
        )}
        {!preset && <RolePicker value={form.role} onChange={(role) => update('role', role)} disabled={self} />}
        {preset && <p className="notice notice-info">{tr('Rol: O\'qituvchi — faqat o\'z guruhlari, dars jadvali va davomatini ko\'radi. Tarif xodimlar limitiga kirmaydi.')}</p>}
        {self && <small className="field-hint">{tr('O\'z rolingizni boshqa administrator o\'zgartiradi.')}</small>}
        {errors.role && (
          <small className="field-error" role="alert">
            {errors.role}
          </small>
        )}
      </form>
    </Modal>
  )
}
