import { useState } from 'react'
import type { FormEvent } from 'react'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../auth/permissions'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

// O'z profili: ism va lavozim (rolni faqat administrator o'zgartiradi)
export function ProfileSettings() {
  const { user, updateOwnProfile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ fullName: user?.fullName ?? '', title: user?.title ?? '' })
  const [errors, setErrors] = useState<{ fullName?: string; title?: string }>({})
  if (!user) return null
  const dirty = form.fullName !== user.fullName || form.title !== user.title

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const result = updateOwnProfile(form.fullName, form.title)
    if (!result.ok) {
      setErrors(result.field === 'title' ? { title: result.error } : { fullName: result.error })
      document.getElementById(result.field === 'title' ? 'profile-role' : 'profile-name')?.focus()
      return
    }
    setForm({ fullName: form.fullName.trim(), title: form.title.trim() })
    toast.success('Profil saqlandi')
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <p className="profile-role-line">
        <span className="muted">Rolingiz:</span> <Badge tone="primary">{ROLE_LABELS[user.role]}</Badge>{' '}
        <small className="muted">{ROLE_DESCRIPTIONS[user.role]}</small>
      </p>
      <div className="form-row">
        <Input
          id="profile-name"
          label="To'liq ism"
          required
          value={form.fullName}
          error={errors.fullName}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, fullName: e.target.value }))
            setErrors({})
          }}
          placeholder="Masalan: Dilshod Karimov"
        />
        <Input
          id="profile-role"
          label="Lavozim"
          value={form.title}
          error={errors.title}
          hint="Masalan: Direktor, Sotuv menejeri"
          onChange={(e) => {
            setForm((prev) => ({ ...prev, title: e.target.value }))
            setErrors({})
          }}
        />
      </div>
      <div className="form-actions">
        <Button type="submit" variant="ghost" icon="save" disabled={!dirty}>
          Profilni saqlash
        </Button>
      </div>
    </form>
  )
}
