// Ilova nomi va identifikatorlari. Ko'rinadigan nom va logo — brenddan (src/constants/brand.ts, VITE_BRAND_*):
// mijozga qarab deploy paytida o'zgaradi, kodga yozilmaydi. index.html dagi %APP_NAME% va boshqalar build paytida
// vite.config.ts orqali xuddi shu brenddan almashtiriladi
import { resolveBrand } from './brand'
import type { Brand } from './brand'

// Vite build paytida import.meta.env ni VITE_BRAND_* qiymatlari bilan almashtiradi (berilmasa — standart brend)
export const BRAND: Brand = resolveBrand(import.meta.env)

export const APP_NAME = BRAND.name

// Ilova ichidagi logo manzili: sayt pastki papkada bo'lsa (GitHub Pages: /eduflow-crm/) — base qo'shiladi
export const BRAND_LOGO_URL = BRAND.logo.startsWith('/') ? `${import.meta.env.BASE_URL}${BRAND.logo.slice(1)}` : BRAND.logo
export const APP_DESCRIPTION = BRAND.description

// JSON zaxira faylidagi "app" maydoni — ichki identifikator, brend bilan O'ZGARMAYDI (eski zaxiralar mos qolsin)
export const BACKUP_APP_ID = 'eduflow-crm'
// Yuklab olinadigan fayl nomlari brenddan: "eduflow-zaxira-2026-11-02.json", "eduflow-mijozlar-2026-11-02.csv"
export const BACKUP_FILE_PREFIX = `${BRAND.slug}-zaxira`
export const EXPORT_FILE_PREFIX = BRAND.slug

// Sahifa sarlavhasi: "Mijozlar · <sayt nomi>"
export function pageTitle(section: string): string {
  return `${section} · ${APP_NAME}`
}
