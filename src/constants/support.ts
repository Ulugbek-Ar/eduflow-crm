import { tr } from '../i18n'

// Sotuvchi (yordam xizmati) kontaktlari — deploy paytida muhit o'zgaruvchilari bilan beriladi
// (VITE_SUPPORT_TELEGRAM, VITE_SUPPORT_PHONE, VITE_SUPPORT_EMAIL). Bo'sh bo'lsa Yordam bo'limida
// "administratorga murojaat qiling" deyiladi, landing'da ariza tugmasi yashiriladi.
// vite.config.ts bu faylni o'qimaydi (import.meta.env faqat ilovada)
export interface SupportContacts {
  telegram: string
  phone: string
  email: string
}

export const SUPPORT_CONTACTS: SupportContacts = {
  telegram: (import.meta.env.VITE_SUPPORT_TELEGRAM ?? '').trim(),
  phone: (import.meta.env.VITE_SUPPORT_PHONE ?? '').trim(),
  email: (import.meta.env.VITE_SUPPORT_EMAIL ?? '').trim(),
}

// Namoyish sayti (GitHub Pages): faqat demo markaz, ro'yxatdan o'tish yo'q
export const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === '1'

// Asosiy sayt (Vercel) manzili — namoyish saytidagi "Bepul sinash" shu yerga olib boradi
export const MAIN_SITE_URL = (import.meta.env.VITE_MAIN_SITE_URL ?? '').trim().replace(/\/+$/, '')

export function hasSupportContacts(contacts: SupportContacts = SUPPORT_CONTACTS): boolean {
  return Boolean(contacts.telegram || contacts.phone || contacts.email)
}

// "@eduflow_uz", "eduflow_uz" yoki "https://t.me/eduflow_uz" -> "eduflow_uz"
export function telegramHandle(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
}

export interface ContactLink {
  kind: 'telegram' | 'phone' | 'email'
  label: string
  value: string
  href: string
}

// Faqat sozlangan kontaktlar
export function contactLinks(contacts: SupportContacts = SUPPORT_CONTACTS): ContactLink[] {
  const links: ContactLink[] = []
  if (contacts.telegram) {
    const handle = telegramHandle(contacts.telegram)
    links.push({ kind: 'telegram', label: 'Telegram', value: `@${handle}`, href: `https://t.me/${handle}` })
  }
  if (contacts.phone) links.push({ kind: 'phone', label: tr('Telefon'), value: contacts.phone, href: `tel:${contacts.phone.replace(/[^\d+]/g, '')}` })
  if (contacts.email) links.push({ kind: 'email', label: 'Email', value: contacts.email, href: `mailto:${contacts.email}` })
  return links
}
