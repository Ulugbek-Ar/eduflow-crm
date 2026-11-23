import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { APP_NAME } from '../constants/app'
import { Icon } from '../constants/navigation'
import { contactLinks, SUPPORT_CONTACTS, telegramHandle } from '../constants/support'
import type { SupportContacts } from '../constants/support'
import { tr } from '../i18n'
import { formatPhone } from '../utils/phone'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { applyMessage, EMPTY_APPLY_FORM, mailtoUrl, telegramShareUrl, telUrl, validateApply } from './apply'
import type { ApplyErrors, ApplyForm } from './apply'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// "Ulanish uchun ariza": forma -> tayyor xabar -> faqat sozlangan kontaktlar orqali yuborish (server kerak emas)
export function ApplyModal({ onClose, contacts = SUPPORT_CONTACTS, siteUrl = '' }: { onClose: () => void; contacts?: SupportContacts; siteUrl?: string }) {
  const [form, setForm] = useState<ApplyForm>(EMPTY_APPLY_FORM)
  const [errors, setErrors] = useState<ApplyErrors>({})
  const [ready, setReady] = useState(false)
  const [copied, setCopied] = useState('')
  // Qadam almashganda fokus yangi qadamga o'tadi (aks holda yo'qolgan tugmadan body'ga tushib, Esc ishlamay qoladi)
  const stepRef = useRef<HTMLDivElement>(null)
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    stepRef.current?.querySelector<HTMLElement>(ready ? '.apply-actions a, .apply-actions button' : 'input')?.focus()
  }, [ready])
  const links = contactLinks(contacts)
  const message = applyMessage(form, APP_NAME)

  const set = (key: keyof ApplyForm, value: string) => {
    setForm((f) => ({ ...f, [key]: key === 'phone' ? formatPhone(value) : value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = validateApply(form)
    setErrors(next)
    if (Object.keys(next).length === 0) setReady(true)
  }

  const copyMessage = async () => {
    setCopied((await copy(message)) ? tr('Xabar nusxalandi — endi uni yuboring') : tr('Nusxa olib bo\'lmadi: matnni belgilab, qo\'lda nusxa oling'))
  }

  return (
    <Modal
      title={tr('Ulanish uchun ariza')}
      description={ready ? tr('Xabar tayyor. Qulay usulni tanlang — sotuvchi siz bilan bog\'lanadi.') : tr('Ma\'lumotlaringizni yozing — tayyor xabar yig\'iladi.')}
      onClose={onClose}
      size="sm"
    >
      <div ref={stepRef}>
      {!ready ? (
        <form className="form apply-form" onSubmit={submit} noValidate>
          <Input label={tr('Ismingiz')} name="name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} required autoComplete="name" />
          <Input
            label={tr('Telefon')}
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            error={errors.phone}
            required
            autoComplete="tel"
          />
          <Input label={tr('O\'quv markazi nomi')} name="center" value={form.center} onChange={(e) => set('center', e.target.value)} error={errors.center} required autoComplete="organization" />
          <Input
            label={tr('O\'quvchilar soni')}
            name="students"
            inputMode="numeric"
            placeholder="120"
            value={form.students}
            onChange={(e) => set('students', e.target.value.replace(/\D/g, '').slice(0, 5))}
            error={errors.students}
            hint={tr('Taxminan — tarifni tanlashga yordam beradi')}
          />
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>
              {tr('Bekor qilish')}
            </Button>
            <Button type="submit">{tr('Davom etish')}</Button>
          </div>
        </form>
      ) : (
        <div className="stack apply-ready">
          <Textarea label={tr('Xabar matni')} value={message} readOnly rows={6} onFocus={(e) => e.target.select()} />
          <div className="apply-actions">
            {links.map((link) => {
              if (link.kind === 'telegram') {
                return (
                  <a key={link.kind} className="btn btn-primary" href={telegramShareUrl(message, siteUrl)} target="_blank" rel="noreferrer" onClick={() => void copy(message)}>
                    <Icon name="mail" size={16} />
                    {tr('Telegram orqali yuborish')}
                  </a>
                )
              }
              if (link.kind === 'email') {
                return (
                  <a key={link.kind} className="btn btn-ghost" href={mailtoUrl(contacts.email, tr('{0}: ulanish uchun ariza', { 0: APP_NAME }), message)}>
                    <Icon name="mail" size={16} />
                    {tr('Email yozish')}
                  </a>
                )
              }
              return (
                <a key={link.kind} className="btn btn-ghost" href={telUrl(contacts.phone)}>
                  <Icon name="phone" size={16} />
                  {tr('Qo\'ng\'iroq qilish: {0}', { 0: contacts.phone })}
                </a>
              )
            })}
            <Button variant="ghost" icon="copy" onClick={copyMessage}>
              {tr('Xabardan nusxa olish')}
            </Button>
          </div>
          {contacts.telegram && <p className="small-note">{tr('Telegram\'da xabarni {0} ga yuboring.', { 0: `@${telegramHandle(contacts.telegram)}` })}</p>}
          {contacts.email && <p className="small-note">{tr('Yoki nusxa olib, {0} manziliga yozing.', { 0: contacts.email })}</p>}
          <p className="apply-status" role="status" aria-live="polite">
            {copied}
          </p>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setReady(false)}>
              {tr('Orqaga')}
            </Button>
            <Button onClick={onClose}>{tr('Tayyor')}</Button>
          </div>
        </div>
      )}
      </div>
    </Modal>
  )
}
