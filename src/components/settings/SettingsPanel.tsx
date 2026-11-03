import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useTheme } from '../../hooks/useTheme'
import type { ThemePreference } from '../../hooks/useTheme'
import type { CsvDelimiter, Currency, DateFormat, Settings } from '../../types/dashboard.types'
import { formatDateWith } from '../../utils/format'
import { formatPhone, phoneDigits } from '../../utils/phone'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { DataSettings } from './DataSettings'
import { SecuritySettings } from './SecuritySettings'

const CURRENCIES: Record<Currency, string> = {
  UZS: 'O\'zbek so\'mi (UZS)',
  USD: 'AQSH dollari (USD)',
}

const DELIMITERS: Record<CsvDelimiter, string> = {
  ';': 'Nuqtali vergul (;) — Excel UZ/RU',
  ',': 'Vergul (,) — Excel EN, Google Sheets',
}

const THEMES: Record<ThemePreference, string> = {
  light: 'Yorug\'',
  dark: 'Qorong\'i',
  system: 'Tizim bo\'yicha',
}

const DATE_FORMATS: DateFormat[] = ['dd.mm.yyyy', 'dd/mm/yyyy', 'yyyy-mm-dd']
// Format namunasi uchun qat'iy sana: 31-yanvar
const SAMPLE_DATE = new Date(2026, 0, 31, 12).toISOString()

const SECTIONS: Array<{ id: string; label: string; icon: IconName }> = [
  { id: 'organization', label: 'Tashkilot', icon: 'building' },
  { id: 'region', label: 'Mintaqa', icon: 'globe' },
  { id: 'profile', label: 'Profil', icon: 'user' },
  { id: 'data', label: 'Ma\'lumotlar', icon: 'database' },
]

type FormErrors = Partial<Record<'orgName' | 'logoText' | 'phone' | 'profileName' | 'profileRole', string>>

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
    if (form.orgName.trim().length < 2) next.orgName = 'Tashkilot nomini kiriting (kamida 2 ta belgi)'
    if (!/^[\p{L}\p{N}]{0,3}$/u.test(form.logoText.trim())) next.logoText = '1–3 ta harf yoki raqam'
    const digits = phoneDigits(form.phone)
    if (digits.length > 0 && digits.length !== 9) next.phone = 'Telefon +998 XX XXX XX XX formatida bo\'lishi kerak'
    if (form.profileName.trim().length > 60) next.profileName = 'Ism 60 belgidan oshmasin'
    if (!form.profileRole.trim()) next.profileRole = 'Lavozimni kiriting'
    setErrors(next)
    if (next.orgName) return orgNameRef.current?.focus()
    if (next.logoText) return logoRef.current?.focus()
    if (next.phone) return phoneRef.current?.focus()
    if (next.profileName || next.profileRole) return document.getElementById(next.profileName ? 'profile-name' : 'profile-role')?.focus()
    updateSettings({
      ...form,
      orgName: form.orgName.trim(),
      logoText: form.logoText.trim().toUpperCase(),
      phone: digits.length === 0 ? '' : form.phone,
      address: form.address.trim(),
      profileName: form.profileName.trim(),
      profileRole: form.profileRole.trim(),
    })
  }

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Sozlamalar bo'limlari">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            <Icon name={section.icon} size={16} />
            {section.label}
          </a>
        ))}
      </nav>

      <div className="settings-content">
        <form id="settings-form" className="stack" onSubmit={handleSubmit} noValidate>
          <SettingsCard id="organization" title="Tashkilot" description="Sidebar va hisobotlarda ko'rinadigan ma'lumotlar">
            <div className="form">
              <div className="form-row">
                <Input
                  ref={orgNameRef}
                  label="Tashkilot nomi"
                  required
                  value={form.orgName}
                  error={errors.orgName}
                  onChange={(e) => update('orgName', e.target.value)}
                />
                <Input
                  ref={logoRef}
                  label="Logo harflari"
                  maxLength={3}
                  value={form.logoText}
                  error={errors.logoText}
                  hint="1–3 belgi, bo'sh bo'lsa ikon ko'rinadi"
                  onChange={(e) => update('logoText', e.target.value.toUpperCase())}
                />
              </div>
              <div className="form-row">
                <Input
                  ref={phoneRef}
                  label="Telefon"
                  type="tel"
                  value={form.phone}
                  error={errors.phone}
                  onChange={(e) => update('phone', formatPhone(e.target.value))}
                  placeholder="+998 71 200 00 00"
                />
                <Input label="Manzil" value={form.address} onChange={(e) => update('address', e.target.value)} />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard id="region" title="Mintaqa va ko'rinish" description="Valyuta, sana, eksport formati va mavzu">
            <div className="form">
              <div className="form-row">
                <Select
                  label="Valyuta"
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value as Currency)}
                  options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: CURRENCIES[c] }))}
                />
                <Select
                  label="Sana formati"
                  value={form.dateFormat}
                  onChange={(e) => update('dateFormat', e.target.value as DateFormat)}
                  options={DATE_FORMATS.map((f) => ({ value: f, label: `${f} — ${formatDateWith(SAMPLE_DATE, f)}` }))}
                />
              </div>
              <div className="form-row">
                <Select
                  label="CSV ajratgichi"
                  value={form.csvDelimiter}
                  onChange={(e) => update('csvDelimiter', e.target.value as CsvDelimiter)}
                  options={(Object.keys(DELIMITERS) as CsvDelimiter[]).map((d) => ({ value: d, label: DELIMITERS[d] }))}
                />
                {/* Mavzu qurilmaga bog'liq afzallik — darhol qo'llanadi, saqlash tugmasi shart emas */}
                <Select
                  label="Mavzu"
                  value={preference}
                  hint="Header'dagi tugma yorug' va qorong'i orasida almashtiradi"
                  onChange={(e) => setPreference(e.target.value as ThemePreference)}
                  options={(Object.keys(THEMES) as ThemePreference[]).map((t) => ({ value: t, label: THEMES[t] }))}
                />
              </div>
            </div>
          </SettingsCard>
        </form>

        <SettingsCard id="profile" title="Profil va xavfsizlik" description="Header'dagi profil menyusida ko'rinadi; kirish logini va paroli">
          <div className="form">
            <div className="form-row">
              <Input
                id="profile-name"
                form="settings-form"
                label="To'liq ism"
                value={form.profileName}
                error={errors.profileName}
                hint="Bo'sh bo'lsa login ko'rsatiladi"
                onChange={(e) => update('profileName', e.target.value)}
                placeholder="Masalan: Dilshod Karimov"
              />
              <Input
                id="profile-role"
                form="settings-form"
                label="Rol / lavozim"
                value={form.profileRole}
                error={errors.profileRole}
                onChange={(e) => update('profileRole', e.target.value)}
                placeholder="Masalan: Direktor"
              />
            </div>
          </div>
          <h3 className="settings-subtitle">Login va parol</h3>
          <SecuritySettings />
        </SettingsCard>

        <SettingsCard id="data" title="Ma'lumotlar" description="Zaxira, tiklash va demo ma'lumotlar">
          <DataSettings />
        </SettingsCard>

        <div className={dirty ? 'save-bar is-dirty' : 'save-bar'} role="region" aria-label="Saqlash">
          <span className="muted">{dirty ? 'Saqlanmagan o\'zgarishlar bor' : 'Barcha o\'zgarishlar saqlangan'}</span>
          <div className="save-actions">
            <Button variant="ghost" disabled={!dirty} onClick={() => setForm(settings)}>
              Bekor qilish
            </Button>
            <Button type="submit" form="settings-form" icon="save" disabled={!dirty}>
              Saqlash
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
