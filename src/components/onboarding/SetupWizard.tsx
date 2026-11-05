import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { ROLE_LABELS, ROLES } from '../../auth/permissions'
import { pageTitle } from '../../constants/app'
import { Icon } from '../../constants/navigation'
import { useAuth } from '../../hooks/useAuth'
import { generateTempPassword } from '../../services/auth.service'
import { completeSetup, createEmptyData, parseBackup, readJson, saveErrorMessage, STORAGE_KEYS } from '../../services/storage.service'
import type { StoredData } from '../../services/storage.service'
import type { Course } from '../../types/course.types'
import type { Currency } from '../../types/dashboard.types'
import type { Role } from '../../types/user.types'
import { validateCourse } from '../../utils/courses'
import { cx } from '../../utils/cx'
import { createId, formatAmountInput, parseAmount } from '../../utils/format'
import { sanitizeSettings } from '../../utils/guards'
import { formatPhone, phoneDigits } from '../../utils/phone'
import { Button, IconButton } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

const STEPS = ['Markaz', 'Kurslar', 'Xodimlar', 'Ma\'lumot'] as const

const COURSE_TEMPLATES = ['Ingliz tili', 'Matematika', 'Rus tili', 'IT / Dasturlash', 'Koreys tili', 'Abituriyent tayyorlov']

const CURRENCIES: Record<Currency, string> = { UZS: 'So\'m (UZS)', USD: 'Dollar (USD)' }

const MAX_BACKUP_SIZE = 10 * 1024 * 1024

interface IssuedStaff {
  id: string
  fullName: string
  login: string
  role: Role
  password: string
}

function StepHeader({ step }: { step: number }) {
  return (
    <ol className="wizard-steps" aria-label="Sozlash qadamlari">
      {STEPS.map((label, index) => (
        <li key={label} className={cx(index === step && 'is-current', index < step && 'is-done')} aria-current={index === step ? 'step' : undefined}>
          <span className="wizard-step-dot" aria-hidden="true">
            {index < step ? <Icon name="check" size={14} /> : index + 1}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  )
}

// Birinchi kirishdan keyin: 4 qadam — markaz, kurslar, xodimlar, ma'lumot. Har qadamni o'tkazib yuborish mumkin
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { addUser } = useAuth()
  const [step, setStep] = useState(0)
  const [settings] = useState(() => sanitizeSettings(readJson(STORAGE_KEYS.settings)))
  const [org, setOrg] = useState({ orgName: settings.orgName, phone: settings.phone, address: settings.address, currency: settings.currency })
  const [orgErrors, setOrgErrors] = useState<{ orgName?: string; phone?: string }>({})
  const [courses, setCourses] = useState<Course[]>([])
  const [courseForm, setCourseForm] = useState({ name: '', price: '', months: '3' })
  const [courseError, setCourseError] = useState('')
  const [staffForm, setStaffForm] = useState<{ fullName: string; login: string; role: Role }>({ fullName: '', login: '', role: 'manager' })
  const [staffError, setStaffError] = useState('')
  const [staffBusy, setStaffBusy] = useState(false)
  const [issued, setIssued] = useState<IssuedStaff[]>([])
  const [backup, setBackup] = useState<{ fileName: string; data: StoredData; dropped: number } | null>(null)
  const [source, setSource] = useState<'empty' | 'backup'>('empty')
  const [error, setError] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = pageTitle('Markazni sozlash')
  }, [])

  // Har qadamda fokus sarlavhaga — ekran o'quvchi yangi qadamni e'lon qiladi
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const validateOrg = (): boolean => {
    const next: typeof orgErrors = {}
    if (org.orgName.trim().length < 2) next.orgName = 'Markaz nomini kiriting'
    const digits = phoneDigits(org.phone)
    if (digits.length > 0 && digits.length !== 9) next.phone = 'Telefon +998 XX XXX XX XX ko\'rinishida'
    setOrgErrors(next)
    return !next.orgName && !next.phone
  }

  const finish = (mode: 'empty' | 'backup') => {
    if (!validateOrg()) {
      setStep(0)
      return
    }
    const orgSettings = {
      ...settings,
      orgName: org.orgName.trim(),
      phone: phoneDigits(org.phone).length === 0 ? '' : org.phone,
      address: org.address.trim(),
      currency: org.currency,
    }
    const data: StoredData =
      mode === 'backup' && backup ? backup.data : { ...createEmptyData(), courses, settings: orgSettings }
    const saved = completeSetup(data)
    if (!saved.ok) {
      setError(saveErrorMessage(saved.reason))
      return
    }
    onDone()
  }

  const next = () => {
    if (step === 0 && !validateOrg()) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const addCourse = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = {
      name: courseForm.name,
      type: 'course' as const,
      durationMonths: courseForm.months.trim() === '' ? 0 : Number(courseForm.months),
      monthlyPrice: parseAmount(courseForm.price),
      activeGroups: 1,
      status: 'active' as const,
    }
    const errors = validateCourse(input, courses)
    const first = errors.name ?? errors.monthlyPrice ?? errors.durationMonths
    if (first) {
      setCourseError(first)
      return
    }
    setCourses((list) => [...list, { ...input, name: input.name.trim().replace(/\s+/g, ' '), id: createId('k'), createdAt: new Date().toISOString() }])
    setCourseForm({ name: '', price: '', months: courseForm.months })
    setCourseError('')
  }

  const addStaff = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStaffBusy(true)
    const password = generateTempPassword()
    const result = await addUser({ ...staffForm, title: '', password })
    setStaffBusy(false)
    if (!result.ok) {
      setStaffError(result.error)
      return
    }
    setIssued((list) => [...list, { id: createId('i'), ...staffForm, fullName: staffForm.fullName.trim(), login: staffForm.login.trim(), password }])
    setStaffForm({ fullName: '', login: '', role: staffForm.role })
    setStaffError('')
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    if (!file) return
    if (file.size > MAX_BACKUP_SIZE) return setError('Fayl hajmi 10 MB dan oshmasligi kerak')
    const result = parseBackup(await file.text())
    if (!result.ok) return setError(result.error)
    setBackup({ fileName: file.name, data: result.data, dropped: result.dropped })
    setSource('backup')
  }

  return (
    <main className="login-page wizard-page">
      <section className="login-card wizard-card" aria-labelledby="wizard-title">
        <div className="wizard-top">
          <StepHeader step={step} />
          <button type="button" className="link-btn wizard-skip" onClick={() => finish('empty')}>
            Keyinroq sozlayman
          </button>
        </div>

        {step === 0 && (
          <div className="wizard-body">
            <h1 id="wizard-title" ref={headingRef} tabIndex={-1}>
              Markaz haqida
            </h1>
            <p className="muted">Bu ma'lumotlar menyuda, cheklarda va hisobotlarda ko'rinadi. Keyin Sozlamalarda o'zgartirish mumkin.</p>
            <Input
              label="O'quv markazi nomi"
              required
              value={org.orgName}
              error={orgErrors.orgName}
              onChange={(e) => {
                setOrg((prev) => ({ ...prev, orgName: e.target.value }))
                setOrgErrors((prev) => ({ ...prev, orgName: undefined }))
              }}
            />
            <div className="form-row">
              <Input
                label="Telefon"
                type="tel"
                value={org.phone}
                error={orgErrors.phone}
                placeholder="+998 71 200 00 00"
                onChange={(e) => {
                  setOrg((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))
                  setOrgErrors((prev) => ({ ...prev, phone: undefined }))
                }}
              />
              <Select
                label="Asosiy valyuta"
                value={org.currency}
                onChange={(e) => setOrg((prev) => ({ ...prev, currency: e.target.value as Currency }))}
                options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: CURRENCIES[c] }))}
              />
            </div>
            <Input label="Manzil" value={org.address} placeholder="Masalan: Toshkent, Chilonzor 9" onChange={(e) => setOrg((prev) => ({ ...prev, address: e.target.value }))} />
          </div>
        )}

        {step === 1 && (
          <div className="wizard-body">
            <h1 id="wizard-title" ref={headingRef} tabIndex={-1}>
              Qaysi kurslar bor?
            </h1>
            <p className="muted">Narx va muddat bo'yicha qarzdorlar va kutilayotgan tushum avtomatik hisoblanadi. Hozir 1–2 tasini qo'shing — qolganini keyin.</p>
            <div className="chip-row" aria-label="Tayyor nomlar">
              {COURSE_TEMPLATES.map((name) => (
                <button key={name} type="button" className="chip" onClick={() => setCourseForm((prev) => ({ ...prev, name }))}>
                  {name}
                </button>
              ))}
            </div>
            <form className="wizard-inline" onSubmit={addCourse} noValidate>
              <Input label="Kurs nomi" value={courseForm.name} onChange={(e) => setCourseForm((prev) => ({ ...prev, name: e.target.value }))} />
              <Input
                label="Oylik narx"
                inputMode="numeric"
                placeholder="650 000"
                value={courseForm.price}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, price: formatAmountInput(e.target.value) }))}
              />
              <Input
                label="Necha oy (0 — muddatsiz)"
                inputMode="numeric"
                value={courseForm.months}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, months: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
              />
              <Button type="submit" icon="plus" variant="ghost">
                Qo'shish
              </Button>
            </form>
            {courseError && (
              <p className="field-error" role="alert">
                {courseError}
              </p>
            )}
            {courses.length > 0 && (
              <ul className="wizard-list" aria-label="Qo'shilgan kurslar">
                {courses.map((c) => (
                  <li key={c.id}>
                    <span>
                      <strong>{c.name}</strong>
                      <small className="muted">
                        {c.monthlyPrice > 0 ? `${formatAmountInput(String(c.monthlyPrice))} / oy` : 'Narx keyin kiritiladi'} ·{' '}
                        {c.durationMonths > 0 ? `${c.durationMonths} oy` : 'muddatsiz'}
                      </small>
                    </span>
                    <IconButton icon="close" label={`${c.name}ni olib tashlash`} onClick={() => setCourses((list) => list.filter((x) => x.id !== c.id))} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="wizard-body">
            <h1 id="wizard-title" ref={headingRef} tabIndex={-1}>
              Xodimlarni qo'shing
            </h1>
            <p className="muted">
              Har bir xodim o'z logini bilan kiradi va faqat roliga mos bo'limlarni ko'radi. Yolg'iz ishlasangiz — bu qadamni o'tkazib yuboring.
            </p>
            <form className="wizard-inline" onSubmit={addStaff} noValidate>
              <Input label="Ism familiya" value={staffForm.fullName} onChange={(e) => setStaffForm((prev) => ({ ...prev, fullName: e.target.value }))} />
              <Input
                label="Login"
                autoCapitalize="none"
                spellCheck={false}
                value={staffForm.login}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, login: e.target.value }))}
              />
              <Select
                label="Rol"
                value={staffForm.role}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, role: e.target.value as Role }))}
                options={ROLES.filter((r) => r !== 'admin').map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              />
              <Button type="submit" icon="userPlus" variant="ghost" disabled={staffBusy}>
                Qo'shish
              </Button>
            </form>
            {staffError && (
              <p className="field-error" role="alert">
                {staffError}
              </p>
            )}
            {issued.length > 0 && (
              <>
                <p className="notice notice-warning">Vaqtinchalik parollarni hozir yozib oling yoki xodimga yuboring — keyin ko'rinmaydi.</p>
                <ul className="wizard-list" aria-label="Qo'shilgan xodimlar">
                  {issued.map((s) => (
                    <li key={s.id}>
                      <span>
                        <strong>{s.fullName}</strong>
                        <small className="muted">
                          {ROLE_LABELS[s.role]} · login: <code>{s.login}</code> · parol: <code className="mono">{s.password}</code>
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-body">
            <h1 id="wizard-title" ref={headingRef} tabIndex={-1}>
              Qanday boshlaymiz?
            </h1>
            <div className="first-run-options" role="radiogroup" aria-label="Boshlang'ich ma'lumot">
              <button type="button" role="radio" aria-checked={source === 'empty'} className={cx('first-run-option', source === 'empty' && 'is-active')} onClick={() => setSource('empty')}>
                <span className="first-run-icon">
                  <Icon name="plus" size={20} />
                </span>
                <span>
                  <strong>Bo'sh boshlash</strong>
                  <small className="muted">Mijozlarni o'zim kiritaman (kiritilgan kurslar saqlanadi)</small>
                </span>
              </button>
              <label className={cx('first-run-option', source === 'backup' && 'is-active')}>
                <span className="first-run-icon">
                  <Icon name="upload" size={20} />
                </span>
                <span>
                  <strong>Zaxiradan tiklash</strong>
                  <small className="muted">
                    {backup
                      ? `${backup.fileName}: ${backup.data.customers.length} mijoz, ${backup.data.transactions.length} tranzaksiya, ${backup.data.courses.length} kurs`
                      : 'Oldin EduFlow\'dan olingan .json fayl'}
                  </small>
                </span>
                <input type="file" accept="application/json,.json" className="sr-only" aria-label="Zaxira faylini tanlash" onChange={handleFile} />
              </label>
            </div>
            {backup && backup.dropped > 0 && <p className="notice notice-warning">{backup.dropped} ta buzuq yozuv o'tkazib yuboriladi.</p>}
          </div>
        )}

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        <div className="wizard-actions">
          {step > 0 && (
            <Button variant="ghost" icon="chevronLeft" onClick={() => setStep((s) => s - 1)}>
              Orqaga
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              {step === 1 && courses.length === 0 ? 'O\'tkazib yuborish' : step === 2 && issued.length === 0 ? 'O\'tkazib yuborish' : 'Keyingi'}
              <Icon name="chevronRight" size={16} />
            </Button>
          ) : (
            <Button icon="check" onClick={() => finish(source === 'backup' && backup ? 'backup' : 'empty')}>
              Boshlash
            </Button>
          )}
        </div>
      </section>
    </main>
  )
}
