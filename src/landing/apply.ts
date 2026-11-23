// Landing CTA'lari va "Ulanish uchun ariza" — sof funksiyalar (testlar bilan).
// Berk ko'cha bo'lmasligi kerak: har bir tugma yo haqiqiy ro'yxatdan o'tishga, yo demo'ga, yo sotuvchiga olib boradi
import { tr } from '../i18n'
import { formatPhone, isValidPhone } from '../utils/phone'

export interface CtaConfig {
  // Namoyish sayti (VITE_DEMO_ONLY=1): bu yerda ro'yxatdan o'tib bo'lmaydi
  demoOnly: boolean
  // Asosiy sayt manzili (VITE_MAIN_SITE_URL), oxirida "/" siz; '' — berilmagan
  mainSiteUrl: string
  // Kamida bitta kontakt sozlangan (ariza yuborish mumkin)
  hasContacts: boolean
  // Shu saytning /app manzili (routeHref('app'))
  appHref: string
  demoHref: string
}

export type CtaAction = { kind: 'link'; href: string; label: string } | { kind: 'apply'; label: string }

export interface LandingCtas {
  primary: CtaAction
  secondary: CtaAction | null
  // Tarif kartalaridagi tugma
  plan: CtaAction
}

export function landingCtas(config: CtaConfig, trialLabel: string): LandingCtas {
  const demo: CtaAction = { kind: 'link', href: config.demoHref, label: tr('Demo\'ni ko\'rish') }
  const apply: CtaAction = { kind: 'apply', label: tr('Ulanish uchun ariza') }
  if (!config.demoOnly) {
    const trial: CtaAction = { kind: 'link', href: config.appHref, label: trialLabel }
    return { primary: trial, secondary: demo, plan: trial }
  }
  if (config.mainSiteUrl) {
    const trial: CtaAction = { kind: 'link', href: `${config.mainSiteUrl}/app`, label: trialLabel }
    return { primary: trial, secondary: demo, plan: trial }
  }
  // Asosiy sayt hali yo'q: demo + sotuvchiga ariza (kontakt bo'lmasa — faqat demo)
  return { primary: demo, secondary: config.hasContacts ? apply : null, plan: config.hasContacts ? apply : demo }
}

export interface ApplyForm {
  name: string
  phone: string
  center: string
  students: string
}

export const EMPTY_APPLY_FORM: ApplyForm = { name: '', phone: '', center: '', students: '' }

export type ApplyErrors = Partial<Record<keyof ApplyForm, string>>

export function validateApply(form: ApplyForm): ApplyErrors {
  const errors: ApplyErrors = {}
  if (form.name.trim().length < 2) errors.name = tr('Ismingizni kiriting')
  if (!isValidPhone(form.phone)) errors.phone = tr('Telefon +998 XX XXX XX XX formatida bo\'lishi kerak')
  if (form.center.trim().length < 2) errors.center = tr('Markaz nomini kiriting')
  if (form.students.trim() && !/^\d{1,5}$/.test(form.students.trim())) errors.students = tr('Faqat son, masalan 120')
  return errors
}

// Sotuvchiga yuboriladigan tayyor xabar
export function applyMessage(form: ApplyForm, appName: string): string {
  const lines = [
    tr('Assalomu alaykum! {0} ga ulanmoqchimiz.', { 0: appName }),
    tr('Ism: {0}', { 0: form.name.trim() }),
    tr('Telefon: {0}', { 0: formatPhone(form.phone) }),
    tr('Markaz: {0}', { 0: form.center.trim() }),
  ]
  if (form.students.trim()) lines.push(tr('O\'quvchilar soni: {0}', { 0: form.students.trim() }))
  return lines.join('\n')
}

// Telegram'da "Ulashish" oynasi: foydalanuvchi xabarni sotuvchi chatiga yuboradi
export function telegramShareUrl(text: string, url: string): string {
  const params = new URLSearchParams()
  if (url) params.set('url', url)
  params.set('text', text)
  return `https://t.me/share/url?${params.toString().replaceAll('+', '%20')}`
}

export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
