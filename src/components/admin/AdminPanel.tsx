import { tr } from '../../i18n'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { PERMISSION_LABELS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES } from '../../auth/permissions'
import type { Permission } from '../../auth/permissions'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import { displayName } from '../../services/users.service'
import type { PublicUser } from '../../types/user.types'
import { getInitials } from '../../utils/customers'
import { cx } from '../../utils/cx'
import { formatDateTimeWith } from '../../utils/format'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { AuditLog } from './AuditLog'
import { StaffFormModal } from './StaffFormModal'
import { TrashBin } from './TrashBin'
import { TempPasswordModal } from './TempPasswordModal'

type Tab = 'staff' | 'audit' | 'trash' | 'sessions' | 'roles'

const TABS: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'staff', label: tr('Xodimlar'), icon: 'customers' },
  { id: 'audit', label: tr('Amallar jurnali'), icon: 'activity' },
  { id: 'trash', label: tr('Savatcha'), icon: 'trash' },
  { id: 'sessions', label: tr('Seanslar'), icon: 'monitor' },
  { id: 'roles', label: tr('Rollar va ruxsatlar'), icon: 'shield' },
]

const PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[]

function Card({ title, description, actions, children }: { title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          <span className="muted">{description}</span>
        </div>
        {actions && <div className="toolbar">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

type Issued = { title: string; fullName: string; login: string; password: string }

function StaffTab() {
  const { users, user: me, updateUser, resetPassword } = useAuth()
  const { formatDate, settings } = useDashboard()
  const confirm = useConfirm()
  const toast = useToast()
  const [editing, setEditing] = useState<PublicUser | 'new' | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const sorted = [...users].sort((a, b) => Number(a.status === 'blocked') - Number(b.status === 'blocked') || a.createdAt.localeCompare(b.createdAt))

  const toggleBlock = async (user: PublicUser) => {
    const blocking = user.status === 'active'
    const ok = await confirm({
      title: blocking ? tr('Xodimni bloklash') : tr('Blokdan chiqarish'),
      message: blocking
        ? tr('{0} tizimga kira olmaydi, ochiq seanslari darhol yopiladi. Ma\'lumotlari va kiritgan yozuvlari saqlanib qoladi.', { 0: displayName(user) })
        : tr('{0} yana o\'z logini va paroli bilan kira oladi.', { 0: displayName(user) }),
      confirmLabel: blocking ? tr('Bloklash') : tr('Blokdan chiqarish'),
      tone: blocking ? 'danger' : 'primary',
    })
    if (!ok) return
    const result = updateUser(user.id, { status: blocking ? 'blocked' : 'active' })
    if (result.ok) toast.success(blocking ? tr('{0} bloklandi', { 0: displayName(user) }) : tr('{0} blokdan chiqarildi', { 0: displayName(user) }))
    else toast.error(result.error)
  }

  const reset = async (user: PublicUser) => {
    const ok = await confirm({
      title: tr('Parolni tiklash'),
      message: tr('{0} uchun yangi vaqtinchalik parol yaratiladi. Eski parol ishlamay qoladi, ochiq seanslari yopiladi.', { 0: displayName(user) }),
      confirmLabel: tr('Yangi parol yaratish'),
      tone: 'primary',
    })
    if (!ok) return
    const result = await resetPassword(user.id)
    if (!result.ok) return toast.error(result.error)
    setIssued({ title: tr('Yangi vaqtinchalik parol'), fullName: displayName(user), login: user.login, password: result.password })
  }

  return (
    <Card
      title={tr('Xodimlar')}
      description={tr('{0} ta faol · har biri o\'z logini bilan kiradi', { 0: users.filter((u) => u.status === 'active').length })}
      actions={
        <Button icon="userPlus" onClick={() => setEditing('new')}>
          {tr('Xodim qo\'shish')}
        </Button>
      }
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{tr('Xodim')}</th>
              <th scope="col">{tr('Rol')}</th>
              <th scope="col">{tr('Holat')}</th>
              <th scope="col">{tr('Oxirgi kirish')}</th>
              <th scope="col">
                <span className="sr-only">{tr('Amallar')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr key={u.id} className={cx(u.status === 'blocked' && 'is-muted')}>
                <td data-label={tr('Xodim')} className="cell-wide">
                  <span className="staff-cell">
                    <span className="avatar avatar-sm" aria-hidden="true">
                      {getInitials(displayName(u))}
                    </span>
                    <span>
                      <strong>{displayName(u)}</strong>
                      {u.id === me?.id && <span className="muted"> {tr('(siz)')}</span>}
                      <small className="cell-sub">
                        {u.login}
                        {u.title ? ` · ${u.title}` : ''}
                      </small>
                    </span>
                  </span>
                </td>
                <td data-label={tr('Rol')}>
                  <Badge tone={u.role === 'admin' ? 'primary' : 'neutral'}>{ROLE_LABELS[u.role]}</Badge>
                </td>
                <td data-label={tr('Holat')}>
                  {u.status === 'blocked' ? (
                    <Badge tone="cancelled">{tr('Bloklangan')}</Badge>
                  ) : u.mustChange ? (
                    <Badge tone="warning">{tr('Parol kutilmoqda')}</Badge>
                  ) : (
                    <Badge tone="paid">{tr('Faol')}</Badge>
                  )}
                </td>
                <td data-label={tr('Oxirgi kirish')} className="nowrap">
                  {u.lastLoginAt ? formatDateTimeWith(u.lastLoginAt, settings.dateFormat) : <span className="muted">{tr('Hali kirmagan')}</span>}
                  <small className="cell-sub">{tr('Qo\'shilgan:')} {formatDate(u.createdAt)}</small>
                </td>
                <td className="cell-actions">
                  <div className="row-actions">
                    <IconButton icon="edit" label={tr('Tahrirlash: {0}', { 0: displayName(u) })} onClick={() => setEditing(u)} />
                    <IconButton icon="key" label={tr('Parolni tiklash: {0}', { 0: displayName(u) })} onClick={() => reset(u)} />
                    {u.id !== me?.id && (
                      <IconButton
                        icon={u.status === 'blocked' ? 'checkCircle' : 'ban'}
                        tone={u.status === 'blocked' ? 'default' : 'danger'}
                        label={u.status === 'blocked' ? tr('Blokdan chiqarish: {0}', { 0: displayName(u) }) : tr('Bloklash: {0}', { 0: displayName(u) })}
                        onClick={() => toggleBlock(u)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <StaffFormModal
          editing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onCreated={(created) => {
            toast.success(tr('{0} qo\'shildi', { 0: created.fullName }))
            setIssued({ title: tr('Xodim qo\'shildi'), ...created })
          }}
        />
      )}
      {issued && <TempPasswordModal {...issued} onClose={() => setIssued(null)} />}
    </Card>
  )
}

function SessionsTab() {
  const { sessions, sessionId, users, revokeSession, revokeOtherSessions, mode } = useAuth()
  const { settings } = useDashboard()
  const confirm = useConfirm()
  const toast = useToast()
  const others = sessions.filter((s) => s.id !== sessionId)
  const nameOf = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    return user ? displayName(user) : tr('O\'chirilgan xodim')
  }

  const revokeAll = async () => {
    const ok = await confirm({
      title: tr('Hammani chiqarish'),
      message: tr('Sizdan boshqa {0} ta ochiq seans yopiladi. Xodimlar qaytadan login va parol bilan kiradi.', { 0: others.length }),
      confirmLabel: tr('Hammasini yopish'),
    })
    if (!ok) return
    revokeOtherSessions()
    toast.success(tr('Boshqa barcha seanslar yopildi'))
  }

  return (
    <Card
      title={tr('Ochiq seanslar')}
      description={mode === 'demo' ? tr('Demo: shu brauzerdagi seanslar') : tr('Shu brauzerda ochilgan seanslar (oxirgi 30 kun)')}
      actions={
        others.length > 0 && (
          <Button variant="danger" icon="logout" onClick={revokeAll}>
            {tr('Hammani chiqarish')}
          </Button>
        )
      }
    >
      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.id} className="session-item">
            <span className="session-icon" aria-hidden="true">
              <Icon name="monitor" size={18} />
            </span>
            <span className="session-info">
              <strong>
                {nameOf(s.userId)}
                {s.id === sessionId && <Badge tone="paid">{tr('Shu seans')}</Badge>}
              </strong>
              <small className="muted">
                {s.device} {tr('· kirgan:')} {formatDateTimeWith(s.startedAt, settings.dateFormat)} {tr('· faol:')} {formatDateTimeWith(s.lastSeenAt, settings.dateFormat)}
              </small>
            </span>
            {s.id !== sessionId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  revokeSession(s.id)
                  toast.success(tr('Seans yopildi'))
                }}
              >
                {tr('Yopish')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small-note">
        {tr('Lokal rejimda ma\'lumot faqat shu brauzerda turadi, shuning uchun bu yerda faqat shu brauzerdagi seanslar ko\'rinadi. Bulutli (Supabase) rejimda barcha qurilmalar ko\'rinadi.')}
      </p>
    </Card>
  )
}

function RolesTab() {
  return (
    <Card title={tr('Rollar va ruxsatlar')} description={tr('Kim nimani ko\'radi va o\'zgartiradi')}>
      <div className="role-cards">
        {ROLES.map((role) => (
          <div key={role} className="role-card">
            <strong>{ROLE_LABELS[role]}</strong>
            <ul>
              {PERMISSIONS.filter((p) => ROLE_PERMISSIONS[role].includes(p)).map((p) => (
                <li key={p}>
                  <Icon name="check" size={14} />
                  {PERMISSION_LABELS[p]}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('staff')
  const { trash } = useDashboard()

  return (
    <div className="stack">
      <div className="tabs" role="tablist" aria-label={tr('Boshqaruv bo\'limlari')}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`admin-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`admin-panel-${t.id}`}
            className={cx('tab', tab === t.id && 'is-active')}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
            {t.id === 'trash' && trash.length > 0 && <span className="tab-count">{trash.length}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
        {tab === 'staff' && <StaffTab />}
        {tab === 'audit' && <AuditLog />}
        {tab === 'trash' && <TrashBin />}
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'roles' && <RolesTab />}
      </div>
    </div>
  )
}
