import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import type { CsvDelimiter, Currency, DateFormat, Settings } from '../../types/dashboard.types'
import { formatDateWith } from '../../utils/format'
import { formatPhone, phoneDigits } from '../../utils/phone'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { CourseSettings } from './CourseSettings'
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

const DATE_FORMATS: DateFormat[] = ['dd.mm.yyyy', 'dd/mm/yyyy', 'yyyy-mm-dd']
// Format namunasi uchun qat'iy sana: 31-yanvar
const SAMPLE_DATE = new Date(2026, 0, 31, 12).toISOString()

const SECTIONS: Array<{ id: string; label: string; icon: IconName }> = [
  { id: 'organization', label: 'Tashkilot', icon: 'building' },
  { id: 'region', label: 'Mintaqa', icon: 'globe' },
  { id: 'security', label: 'Xavfsizlik', icon: 'lock' },
  { id: 'courses', label: 'Kurslar', icon: 'book' },
  { id: 'data', label: 'Ma\'lumotlar', icon: 'database' },
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

          <SettingsCard id="region" title="Mintaqa" description="Valyuta, sana va eksport formati">
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
              <Select
                label="CSV ajratgichi"
                value={form.csvDelimiter}
                onChange={(e) => update('csvDelimiter', e.target.value as CsvDelimiter)}
                options={(Object.keys(DELIMITERS) as CsvDelimiter[]).map((d) => ({ value: d, label: DELIMITERS[d] }))}
              />
            </div>
          </SettingsCard>
        </form>

        <SettingsCard id="security" title="Xavfsizlik" description="Kirish logini va paroli">
          <SecuritySettings />
        </SettingsCard>

        <SettingsCard id="courses" title="Kurslar" description="Mijoz formalarida tanlanadigan kurslar ro'yxati">
          <CourseSettings courses={form.courses} onChange={(courses) => update('courses', courses)} />
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
