import { changeLang, getLang, LANG_LABELS, tr } from '../../i18n'
import type { Lang } from '../../i18n'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import type { Permission } from '../../auth/permissions'
import { useDashboard } from '../../context/useDashboard'
import { useCan, useRoleCan } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import type { ThemePreference } from '../../hooks/useTheme'
import type { CsvDelimiter, Currency, DateFormat, Settings } from '../../types/dashboard.types'
import { formatDateWith } from '../../utils/format'
import { formatPhone, phoneDigits } from '../../utils/phone'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import { REMINDER_VARIABLES } from '../../utils/reminders'
import { DEFAULT_REMINDER_RU, DEFAULT_REMINDER_UZ } from '../../constants/mockData'
import { Select } from '../ui/Select'
import { DataSettings } from './DataSettings'
import { LogoUpload } from './LogoUpload'
import { PlanSettings } from './PlanSettings'
import { ProfileSettings } from './ProfileSettings'
import { SecuritySettings } from './SecuritySettings'

const CURRENCIES: Record<Currency, string> = {
  UZS: tr('O\'zbek so\'mi (UZS)'),
  USD: tr('AQSH dollari (USD)'),
}

const DELIMITERS: Record<CsvDelimiter, string> = {
  ';': tr('Nuqtali vergul (;) — Excel UZ/RU'),
  ',': tr('Vergul (,) — Excel EN, Google Sheets'),
}

const THEMES: Record<ThemePreference, string> = {
  light: tr('Yorug\''),
  dark: tr('Qorong\'i'),
  system: tr('Tizim bo\'yicha'),
}

const DATE_FORMATS: DateFormat[] = ['dd.mm.yyyy', 'dd/mm/yyyy', 'yyyy-mm-dd']
// Format namunasi uchun qat'iy sana: 31-yanvar
const SAMPLE_DATE = new Date(2026, 0, 31, 12).toISOString()

// permission — bo'limni ko'rish uchun kerakli ruxsat (null — hammaga)
// anyPlan — tarif muddati tugaganda ham ko'rinadi (tarifni ko'rish va ma'lumotni yuklab olish uchun)
const SECTIONS: Array<{ id: string; label: string; icon: IconName; permission: Permission | null; anyPlan?: true }> = [
  { id: 'organization', label: tr('Tashkilot'), icon: 'building', permission: 'settings.manage' },
  { id: 'region', label: tr('Mintaqa'), icon: 'globe', permission: 'settings.manage' },
  { id: 'learning', label: tr('O\'quv jarayoni'), icon: 'calendar', permission: 'settings.manage' },
  { id: 'appearance', label: tr('Ko\'rinish'), icon: 'sun', permission: null },
  { id: 'profile', label: tr('Profil'), icon: 'user', permission: null },
  { id: 'plan', label: tr('Tarif'), icon: 'card', permission: 'staff.manage', anyPlan: true },
  { id: 'data', label: tr('Ma\'lumotlar'), icon: 'database', permission: 'data.manage', anyPlan: true },
]

type FormErrors = Partial<Record<'orgName' | 'logoText' | 'phone', string>>

function SettingsCard({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="card settings-card" aria-labelledby={`${id}-title`}>
      <div className="card-head">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <span className="muted">{description}</span>
        </div>
      </div>
      {children}
    </section>
  )
}

export function SettingsPanel() {
  const { settings, updateSettings, setUnsavedChanges } = useDashboard()
  const can = useCan()
  const roleCan = useRoleCan()
  const canManage = can('settings.manage')
  const { preference, setPreference } = useTheme()
  const [form, setForm] = useState<Settings>(settings)
  const [errors, setErrors] = useState<FormErrors>({})
  const orgNameRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  // Sozlamalar tashqaridan o'zgarsa (import, tiklash, boshqa tab) qoralama yangilanadi
  const [source, setSource] = useState(settings)
  if (settings !== source) {
    setSource(settings)
    setForm(settings)
    setErrors({})
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(settings)

  useEffect(() => {
    setUnsavedChanges(dirty)
  }, [dirty, setUnsavedChanges])

  useEffect(() => () => setUnsavedChanges(false), [setUnsavedChanges])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: FormErrors = {}
    if (form.orgName.trim().length < 2) next.orgName = tr('Tashkilot nomini kiriting (kamida 2 ta belgi)')
    if (!/^[\p{L}\p{N}]{0,3}$/u.test(form.logoText.trim())) next.logoText = tr('1–3 ta harf yoki raqam')
    const digits = phoneDigits(form.phone)
    if (digits.length > 0 && digits.length !== 9) next.phone = tr('Telefon +998 XX XXX XX XX formatida bo\'lishi kerak')
    setErrors(next)
    if (next.orgName) return orgNameRef.current?.focus()
    if (next.logoText) return logoRef.current?.focus()
    if (next.phone) return phoneRef.current?.focus()
    updateSettings({
      ...form,
      orgName: form.orgName.trim(),
      logoText: form.logoText.trim().toUpperCase(),
      phone: digits.length === 0 ? '' : form.phone,
      address: form.address.trim(),
      paymentDueDay: form.paymentDueDay >= 1 ? form.paymentDueDay : 10,
      // Bo'sh shablon — standart matn
      reminderTemplateUz: form.reminderTemplateUz.trim() || DEFAULT_REMINDER_UZ,
      reminderTemplateRu: form.reminderTemplateRu.trim() || DEFAULT_REMINDER_RU,
    })
  }

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={tr('Sozlamalar bo\'limlari')}>
        {SECTIONS.filter((section) => !section.permission || (section.anyPlan ? roleCan : can)(section.permission)).map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            <Icon name={section.icon} size={16} />
            {section.label}
          </a>
        ))}
      </nav>

      <div className="settings-content">
        {canManage && (
        <form id="settings-form" className="stack" onSubmit={handleSubmit} noValidate>
          <SettingsCard id="organization" title={tr('Tashkilot')} description={tr('Sidebar va hisobotlarda ko\'rinadigan ma\'lumotlar')}>
            <div className="form">
              <LogoUpload value={form.logoImage} logoText={form.logoText} onChange={(value) => update('logoImage', value)} />
              <div className="form-row">
                <Input
                  ref={orgNameRef}
                  label={tr('Tashkilot nomi')}
                  required
                  value={form.orgName}
                  error={errors.orgName}
                  onChange={(e) => update('orgName', e.target.value)}
                />
                <Input
                  ref={logoRef}
                  label={tr('Logo harflari')}
                  maxLength={3}
                  value={form.logoText}
                  error={errors.logoText}
                  hint={tr('1–3 belgi; logotip rasmi bo\'lmasa ko\'rinadi')}
                  onChange={(e) => update('logoText', e.target.value.toUpperCase())}
                />
              </div>
              <div className="form-row">
                <Input
                  ref={phoneRef}
                  label={tr('Telefon')}
                  type="tel"
                  value={form.phone}
                  error={errors.phone}
                  onChange={(e) => update('phone', formatPhone(e.target.value))}
                  placeholder="+998 71 200 00 00"
                />
                <Input label={tr('Manzil')} value={form.address} onChange={(e) => update('address', e.target.value)} />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard id="region" title={tr('Mintaqa va ko\'rinish')} description={tr('Valyuta, sana, eksport formati va mavzu')}>
            <div className="form">
              <div className="form-row">
                <Select
                  label={tr('Asosiy valyuta')}
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value as Currency)}
                  options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: CURRENCIES[c] }))}
                />
                <Select
                  label={tr('Sana formati')}
                  value={form.dateFormat}
                  onChange={(e) => update('dateFormat', e.target.value as DateFormat)}
                  options={DATE_FORMATS.map((f) => ({ value: f, label: `${f} — ${formatDateWith(SAMPLE_DATE, f)}` }))}
                />
              </div>
              <div className="form-row">
                <Select
                  label={tr('CSV ajratgichi')}
                  value={form.csvDelimiter}
                  onChange={(e) => update('csvDelimiter', e.target.value as CsvDelimiter)}
                  options={(Object.keys(DELIMITERS) as CsvDelimiter[]).map((d) => ({ value: d, label: DELIMITERS[d] }))}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard id="learning" title={tr('O\'quv jarayoni')} description={tr('Davomat, to\'lov muddati va qarz hisobi')}>
            <div className="form">
              <div className="form-row">
                <Input
                  label={tr('O\'qituvchi davomatni necha kun orqagacha tahrirlaydi')}
                  type="number"
                  min={0}
                  max={60}
                  inputMode="numeric"
                  value={String(form.attendanceEditDays)}
                  hint={tr('Bugun + shuncha kun (0 — faqat bugun). Administrator va menejer istalgan kunni tahrirlaydi.')}
                  onChange={(e) => update('attendanceEditDays', Math.max(0, Math.min(60, Math.round(Number(e.target.value) || 0))))}
                />
                <Input
                  label={tr('Oylik to\'lov muddati (oyning sanasi)')}
                  type="number"
                  min={1}
                  max={28}
                  inputMode="numeric"
                  value={form.paymentDueDay > 0 ? String(form.paymentDueDay) : ''}
                  hint={tr('Shu sanagacha to\'lanmasa — qarz. Birinchi oy o\'qish boshlangan kuni to\'lanadi.')}
                  // Bo'sh maydon vaqtincha 0 (saqlashda — standart 10), 28 dan katta — 28
                  onChange={(e) => update('paymentDueDay', Math.max(0, Math.min(28, Math.round(Number(e.target.value) || 0))))}
                />
              </div>
              <label className="check-field">
                <input type="checkbox" checked={form.prorateFirstMonth} onChange={(e) => update('prorateFirstMonth', e.target.checked)} />
                <span>
                  {tr('Birinchi oyni kunlar bo\'yicha hisoblash')}
                  <small className="muted cell-block">{tr('Oy o\'rtasida qo\'shilgan o\'quvchi shu oy uchun faqat qolgan kunlar ulushini to\'laydi')}</small>
                </span>
              </label>
              <Textarea
                label={tr('To\'lov eslatmasi shabloni (o\'zbekcha)')}
                rows={3}
                maxLength={600}
                value={form.reminderTemplateUz}
                onChange={(e) => update('reminderTemplateUz', e.target.value)}
              />
              <Textarea
                label={tr('To\'lov eslatmasi shabloni (ruscha)')}
                rows={3}
                maxLength={600}
                value={form.reminderTemplateRu}
                hint={tr('O\'zgaruvchilar: {0}', { 0: REMINDER_VARIABLES.map((v) => `{${v}}`).join(' ') })}
                onChange={(e) => update('reminderTemplateRu', e.target.value)}
              />
            </div>
          </SettingsCard>
        </form>
        )}

        <SettingsCard id="appearance" title={tr('Ko\'rinish')} description={tr('Faqat shu qurilmada: darhol qo\'llanadi')}>
          <div className="form">
            <div className="form-row">
              <Select
                label={tr('Mavzu')}
                value={preference}
                hint={tr('Header\'dagi tugma yorug\' va qorong\'i orasida almashtiradi')}
                onChange={(e) => setPreference(e.target.value as ThemePreference)}
                options={(Object.keys(THEMES) as ThemePreference[]).map((t) => ({ value: t, label: THEMES[t] }))}
              />
              <Select
                label="Til / Язык"
                value={getLang()}
                hint={tr('Tanlangach sahifa yangi tilda qayta ochiladi')}
                onChange={(e) => changeLang(e.target.value as Lang)}
                options={(Object.keys(LANG_LABELS) as Lang[]).map((l) => ({ value: l, label: LANG_LABELS[l] }))}
              />
            </div>
          </div>
        </SettingsCard>

        <SettingsCard id="profile" title={tr('Profil va xavfsizlik')} description={tr('Header\'dagi profil menyusida ko\'rinadi; kirish logini va paroli')}>
          <ProfileSettings />
          <h3 className="settings-subtitle">{tr('Login va parol')}</h3>
          <SecuritySettings />
        </SettingsCard>

        {roleCan('staff.manage') && (
          <SettingsCard id="plan" title={tr('Tarif')} description={tr('Joriy tarif, muddat va xodimlar chegarasi')}>
            <PlanSettings />
          </SettingsCard>
        )}

        {roleCan('data.manage') && (
          <SettingsCard id="data" title={tr('Ma\'lumotlar')} description={tr('Zaxira, tiklash va demo ma\'lumotlar')}>
            <DataSettings />
          </SettingsCard>
        )}

        {canManage && (
        <div className={dirty ? 'save-bar is-dirty' : 'save-bar'} role="region" aria-label={tr('Saqlash')}>
          <span className="muted">{dirty ? tr('Saqlanmagan o\'zgarishlar bor') : tr('Barcha o\'zgarishlar saqlangan')}</span>
          <div className="save-actions">
            <Button variant="ghost" disabled={!dirty} onClick={() => setForm(settings)}>
              {tr('Bekor qilish')}
            </Button>
            <Button type="submit" form="settings-form" icon="save" disabled={!dirty}>
              {tr('Saqlash')}
            </Button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
