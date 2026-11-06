import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { APP_NAME } from '../constants/app'
import { Icon } from '../constants/navigation'
import { PLANS } from '../constants/plans'
import type { PlanId } from '../constants/plans'
import { ConfirmProvider } from '../components/ui/ConfirmDialog'
import { ToastProvider } from '../components/ui/Toast'
import { Badge } from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Select } from '../components/ui/Select'
import { useConfirm } from '../hooks/useConfirm'
import { useToast } from '../hooks/useToast'
import { checkPassword, PBKDF2_ITERATIONS } from '../services/auth.service'
import { formatDateWith, formatMoney, formatNumber } from '../utils/format'
import { isCloudEnabled } from '../data/config'
import { cloudTenantsRepository, ownerSignIn } from './cloudTenants'
import { extendPatch, localTenantsRepository, monthlyRevenue, tenantDaysLeft, tenantEnd } from './tenants'
import type { Tenant, TenantsRepository } from './tenants'
import '../landing/landing.css'

// Sotuvchi paneli paroli: VITE_OWNER_PASSWORD_HASH = "tuz:xesh" (npm run owner:password bilan yasaladi).
// Berilmasa — demo: namunaviy markazlar, kirish so'ralmaydi. Haqiqiy himoya — Supabase'dagi platform_admins (RLS)
const OWNER_HASH = import.meta.env.VITE_OWNER_PASSWORD_HASH ?? ''
const SESSION_KEY = 'eduflow-owner:session'

type Filter = 'all' | 'trial' | 'paid' | 'expiring' | 'expired' | 'blocked'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Hammasi' },
  { id: 'trial', label: 'Sinovda' },
  { id: 'paid', label: 'To\'lovli' },
  { id: 'expiring', label: 'Tugayapti (≤5 kun)' },
  { id: 'expired', label: 'Muddati o\'tgan' },
  { id: 'blocked', label: 'Bloklangan' },
]

function matches(t: Tenant, filter: Filter, now: number): boolean {
  const left = tenantDaysLeft(t, now)
  switch (filter) {
    case 'all':
      return true
    case 'trial':
      return t.plan === 'trial' && t.status === 'active'
    case 'paid':
      return t.plan !== 'trial' && t.status === 'active'
    case 'expiring':
      return t.status === 'active' && left !== null && left > 0 && left <= 5
    case 'expired':
      return t.status === 'active' && left !== null && left <= 0
    case 'blocked':
      return t.status === 'blocked'
  }
}

function stateOf(t: Tenant, now: number): { label: string; tone: BadgeTone } {
  const left = tenantDaysLeft(t, now)
  if (t.status === 'blocked') return { label: 'Bloklangan', tone: 'cancelled' }
  if (left !== null && left <= 0) return { label: 'Muddati o\'tgan', tone: 'cancelled' }
  if (left !== null && left <= 5) return { label: `${left} kun qoldi`, tone: 'warning' }
  return t.plan === 'trial' ? { label: 'Sinov', tone: 'primary' } : { label: 'Faol', tone: 'paid' }
}

function OwnerLogin({ onDone, cloud }: { onDone: () => void; cloud: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (cloud) {
      setBusy(true)
      const result = await ownerSignIn(email, password)
      setBusy(false)
      if (result === 'ok') return onDone()
      setError(result === 'not-owner' ? 'Bu hisob sotuvchi emas (platform_admins jadvalida yo\'q)' : 'Email yoki parol noto\'g\'ri')
      setPassword('')
      return
    }
    const [salt, passwordHash] = OWNER_HASH.split(':')
    setBusy(true)
    const ok = Boolean(salt && passwordHash) && (await checkPassword({ salt, passwordHash, algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS }, password))
    setBusy(false)
    if (!ok) {
      setError('Parol noto\'g\'ri')
      setPassword('')
      return
    }
    sessionStorage.setItem(SESSION_KEY, '1')
    onDone()
  }
  return (
    <main className="login-page">
      <form className="login-card auth-form" onSubmit={submit} noValidate aria-labelledby="owner-title">
        <div className="login-brand">
          <span className="logo-mark">
            <Icon name="shield" size={22} />
          </span>
          <div>
            <h1 id="owner-title">Sotuvchi paneli</h1>
            <p className="muted">{APP_NAME} · markazlar va tariflar</p>
          </div>
        </div>
        {cloud && <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}
        <PasswordInput label="Parol" autoComplete="current-password" value={password} error={error} onChange={(e) => setPassword(e.target.value)} autoFocus={!cloud} />
        <Button type="submit" className="btn-block" disabled={busy || !password}>
          {busy ? 'Tekshirilmoqda...' : 'Kirish'}
        </Button>
      </form>
    </main>
  )
}

function Console({ repo }: { repo: TenantsRepository }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [now] = useState(Date.now)

  useEffect(() => {
    let alive = true
    repo.list().then((list) => alive && setTenants(list))
    return () => {
      alive = false
    }
  }, [repo])

  const apply = async (tenant: Tenant, patch: Parameters<TenantsRepository['update']>[1], message: string) => {
    const next = await repo.update(tenant.id, patch)
    setTenants((list) => list?.map((t) => (t.id === next.id ? next : t)) ?? null)
    toast.success(message)
  }

  if (!tenants) return <p className="section-loading">Yuklanmoqda...</p>

  const q = query.trim().toLowerCase()
  const rows = tenants.filter((t) => matches(t, filter, now) && (!q || `${t.name} ${t.city} ${t.contact}`.toLowerCase().includes(q)))
  const count = (f: Filter) => tenants.filter((t) => matches(t, f, now)).length
  const date = (iso?: string) => (iso ? formatDateWith(iso, 'dd.mm.yyyy') : '—')

  const toggleBlock = async (t: Tenant) => {
    const blocking = t.status === 'active'
    const ok = await confirm({
      title: blocking ? 'Markazni to\'xtatish' : 'Markazni faollashtirish',
      message: blocking
        ? `"${t.name}" xodimlari panelni faqat ko'ra oladi, o'zgartira olmaydi. Ma'lumotlari o'chmaydi.`
        : `"${t.name}" yana to'liq ishlay oladi.`,
      confirmLabel: blocking ? 'To\'xtatish' : 'Faollashtirish',
      tone: blocking ? 'danger' : 'primary',
    })
    if (ok) await apply(t, { status: blocking ? 'blocked' : 'active' }, blocking ? `"${t.name}" to'xtatildi` : `"${t.name}" faollashtirildi`)
  }

  return (
    <div className="owner">
      <header className="lp-header">
        <span className="lp-brand">
          <span className="logo-mark" aria-hidden="true">
            <Icon name="shield" size={20} />
          </span>
          <strong>Sotuvchi paneli</strong>
        </span>
        {repo.kind === 'demo' && <Badge tone="warning">Demo: namunaviy markazlar</Badge>}
      </header>
      <main className="owner-main">
        {repo.kind === 'demo' && (
          <p className="notice notice-info">
            Lokal rejimda har markaz ma'lumoti o'z brauzerida — bu yerda namunaviy ro'yxat. Supabase ulangach (README → "Bulutli rejim") haqiqiy
            markazlar, tarif va muddatlar shu yerdan boshqariladi va cheklovlar majburiy bo'ladi.
          </p>
        )}
        <section className="kpi-grid" aria-label="Umumiy ko'rsatkichlar">
          {[
            { label: 'Markazlar', value: formatNumber(tenants.length), hint: `${count('blocked')} ta bloklangan` },
            { label: 'Sinovda', value: formatNumber(count('trial')), hint: 'bepul 14 kun' },
            { label: 'To\'lovli', value: formatNumber(count('paid')), hint: `${count('expiring')} tasi 5 kun ichida tugaydi` },
            { label: 'Oylik tushum', value: formatMoney(monthlyRevenue(tenants, now), 'UZS'), hint: 'faol to\'lovli tariflar' },
          ].map((k) => (
            <article key={k.label} className="card kpi">
              <div className="kpi-body">
                <h2 className="kpi-title">{k.label}</h2>
                <strong>{k.value}</strong>
                <span className="kpi-foot muted">{k.hint}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="card" aria-labelledby="tenants-title">
          <div className="card-head">
            <div>
              <h2 id="tenants-title">Markazlar</h2>
              <span className="muted">{rows.length} ta ko'rsatilmoqda</span>
            </div>
          </div>
          <div className="filters">
            <Input label="Qidirish" type="search" placeholder="Nom, shahar yoki telefon" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Select
              label="Holat"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              options={FILTERS.map((f) => ({ value: f.id, label: `${f.label} (${count(f.id)})` }))}
            />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Markaz</th>
                  <th scope="col">Tarif</th>
                  <th scope="col">Holat</th>
                  <th scope="col">Amal qiladi</th>
                  <th scope="col" className="align-right">
                    Xodim / mijoz
                  </th>
                  <th scope="col">
                    <span className="sr-only">Amallar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const state = stateOf(t, now)
                  return (
                    <tr key={t.id} className={t.status === 'blocked' ? 'is-muted' : undefined}>
                      <td data-label="Markaz" className="cell-wide">
                        <strong>{t.name}</strong>
                        <small className="cell-sub">
                          {t.city} · {t.contact} · qo'shilgan {date(t.createdAt)}
                        </small>
                      </td>
                      <td data-label="Tarif">
                        <select
                          className="input input-sm"
                          aria-label={`${t.name}: tarif`}
                          value={t.plan}
                          onChange={(e) => apply(t, { plan: e.target.value as PlanId }, `${t.name}: tarif o'zgartirildi`)}
                        >
                          {PLANS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Holat">
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td data-label="Amal qiladi" className="nowrap">
                        {date(tenantEnd(t))}
                      </td>
                      <td data-label="Xodim / mijoz" className="align-right">
                        {t.staffCount} / {formatNumber(t.customerCount)}
                      </td>
                      <td className="cell-actions">
                        <div className="row-actions">
                          <Button size="sm" variant="ghost" onClick={() => apply(t, extendPatch(t, 30, now), `${t.name}: +30 kun`)} aria-label={`${t.name}: 30 kunga uzaytirish`}>
                            +30 kun
                          </Button>
                          <Button size="sm" variant={t.status === 'active' ? 'ghost' : 'primary'} onClick={() => toggleBlock(t)}>
                            {t.status === 'active' ? 'To\'xtatish' : 'Faollashtirish'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

export function OwnerConsole({ repo: given }: { repo?: TenantsRepository }) {
  // Supabase ulangan bo'lsa — haqiqiy markazlar (sotuvchi email/parol bilan kiradi); aks holda namunaviy ro'yxat
  const cloud = !given && isCloudEnabled()
  const [repo] = useState<TenantsRepository>(() => given ?? (cloud ? cloudTenantsRepository() : localTenantsRepository()))
  const [unlocked, setUnlocked] = useState(() => !cloud && (!OWNER_HASH || sessionStorage.getItem(SESSION_KEY) === '1'))
  useEffect(() => {
    document.title = `Sotuvchi paneli · ${APP_NAME}`
  }, [])
  return (
    <ToastProvider>
      <ConfirmProvider>{unlocked ? <Console repo={repo} /> : <OwnerLogin cloud={cloud} onDone={() => setUnlocked(true)} />}</ConfirmProvider>
    </ToastProvider>
  )
}
