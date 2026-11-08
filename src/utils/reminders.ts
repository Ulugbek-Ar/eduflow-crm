// To'lov eslatmalari: shablon o'zgaruvchilari {ism} {summa} {kurs} {guruh} {oy} {markaz} {telefon} {havola}
import type { Lang } from '../i18n'

export const REMINDER_VARIABLES = ['ism', 'summa', 'kurs', 'guruh', 'oy', 'markaz', 'telefon', 'havola'] as const
export type ReminderVariable = (typeof REMINDER_VARIABLES)[number]

const MONTHS: Record<Lang, readonly string[]> = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
}

export function monthName(date: Date, lang: Lang): string {
  return MONTHS[lang][date.getMonth()]
}

// Shablondagi {o'zgaruvchi} qiymat bilan almashtiriladi; noma'lum o'zgaruvchi o'z holicha qoladi
export function fillTemplate(template: string, values: Partial<Record<ReminderVariable, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key as ReminderVariable]
    return value === undefined ? match : value
  })
}

// Telefon raqami SMS/qo'ng'iroq havolasi uchun: "+998 90 123 45 67" -> "+998901234567"
export function phoneHref(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

export function smsUrl(phone: string, body: string): string {
  return `sms:${phoneHref(phone)}?body=${encodeURIComponent(body)}`
}

export function telegramShare(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${encodeURIComponent(text)}`
}

// "3 kun oldin" kabi nisbiy vaqt (eslatma qachon yuborilgani)
export function daysAgo(iso: string, now = new Date()): number {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.max(0, Math.round((day(now) - day(new Date(iso))) / 86_400_000))
}

const LINK_LABEL: Record<Lang, string> = { uz: 'To\'lov havolasi:', ru: 'Ссылка для оплаты:' }

// Onlayn to'lov havolasi: shablonda {havola} bo'lsa — o'sha joyga, bo'lmasa (append = true) — oxiriga alohida qatorda
export function withPaymentLink(template: string, text: string, link: string | null, lang: Lang, append: boolean): string {
  if (!link || template.includes('{havola}') || !append) return text
  return `${text}\n${LINK_LABEL[lang]} ${link}`
}
