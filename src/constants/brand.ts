// Mahsulot brendi — sayt nomi va logosi. Har mijoz uchun o'zgaradi, shuning uchun kodga yozilmaydi:
// deploy paytida muhit o'zgaruvchilari bilan beriladi (Vercel → Environment Variables, GitHub → Variables, lokal —
// .env.local). Berilmasa — standart (EduFlow). Ro'yxat va tartib: README → "Brend (sayt nomi va logosi)".
//
//   VITE_BRAND_NAME         — to'liq nom: sahifa sarlavhasi, landing, kirish ekrani ("EduFlow CRM")
//   VITE_BRAND_SHORT_NAME   — qisqa nom: matnlar ichida ("EduFlow'ga kirish"), fayl nomlari ("eduflow-zaxira-...json")
//   VITE_BRAND_DESCRIPTION  — qidiruv tizimlari uchun tavsif (meta description)
//   VITE_BRAND_LOGO         — logo rasmi: public/ ichidagi yo'l (/brand/logo.svg); bo'sh — ichki belgi
//   VITE_BRAND_FAVICON      — brauzer yorlig'idagi belgi (bo'sh — logo, u ham bo'lmasa /favicon.svg)
//   VITE_BRAND_APPLE_ICON   — iPhone "Bosh ekranga qo'shish" belgisi, PNG 180×180 (bo'sh — /apple-touch-icon.png)
//   VITE_BRAND_OG_IMAGE     — Telegram/Facebook'da havola rasmi, 1200×630, yo'l yoki https URL (bo'sh — /og-image.jpg)
// Logo va belgilar sayt ichida bo'lishi kerak (public/brand/...): xavfsizlik siyosati (CSP) tashqi rasmni yuklatmaydi.
//
// Markazning o'z nomi va logosi (ilova ichida, chekda, eslatmalarda) — bu emas: uni har markaz
// Sozlamalar → Tashkilot'da o'zi kiritadi. Ichki kalitlar (localStorage "apex:*", zaxira "app" maydoni) brend bilan
// o'zgarmaydi — aks holda eski ma'lumot va zaxiralar o'qilmay qoladi.
// Bu fayl sof (import.meta yo'q): ilova BRAND ni src/constants/app.ts dan oladi, vite.config.ts esa shu
// resolveBrand() bilan index.html sarlavhasi, favicon va og:image ni to'ldiradi — bitta manba, ikki joyda bir xil natija.

export interface Brand {
  name: string
  shortName: string
  description: string
  logo: string
  favicon: string
  appleIcon: string
  ogImage: string
  // Fayl nomlari uchun: kichik lotin harflari, raqam va "-" ("eduflow")
  slug: string
}

export const DEFAULT_BRAND_NAME = 'EduFlow CRM'
const DEFAULT_DESCRIPTION =
  'o\'quv markazlari uchun CRM: lidlar, guruhlar, dars jadvali, davomat, to\'lovlar, qarzdorlar, kassa va hisobotlar bitta panelda'

type Env = Record<string, string | boolean | undefined>

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '')

// Sayt ichidagi rasm: "/..." (public/) yoki "data:image/..."; boshqa narsa (javascript:, tashqi URL) — e'tiborsiz
const localAsset = (value: unknown): string => {
  const v = text(value, 2000)
  return /^(\/(?!\/)|data:image\/)/i.test(v) ? v : ''
}

// Havola rasmi (og:image) — ijtimoiy tarmoqlar o'zi yuklaydi, shuning uchun https URL ham mumkin
const shareAsset = (value: unknown): string => {
  const v = text(value, 2000)
  return localAsset(v) || (/^https:\/\//i.test(v) ? v : '')
}

// "Bilim CRM" -> "bilim"; lotin harfi bo'lmasa — "crm"
export function brandSlug(shortName: string): string {
  const slug = shortName
    .toLowerCase()
    .replace(/[ʻʼ'`’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '')
  return slug || 'crm'
}

export function resolveBrand(env: Env = {}): Brand {
  const name = text(env.VITE_BRAND_NAME, 60) || DEFAULT_BRAND_NAME
  // Qisqa nom berilmasa — to'liq nomning birinchi so'zi ("EduFlow CRM" -> "EduFlow")
  const shortName = text(env.VITE_BRAND_SHORT_NAME, 30) || name.split(' ')[0]
  const logo = localAsset(env.VITE_BRAND_LOGO)
  return {
    name,
    shortName,
    description: text(env.VITE_BRAND_DESCRIPTION, 300) || DEFAULT_DESCRIPTION,
    logo,
    favicon: localAsset(env.VITE_BRAND_FAVICON) || logo || '/favicon.svg',
    appleIcon: localAsset(env.VITE_BRAND_APPLE_ICON) || '/apple-touch-icon.png',
    ogImage: shareAsset(env.VITE_BRAND_OG_IMAGE) || '/og-image.jpg',
    slug: brandSlug(shortName),
  }
}
