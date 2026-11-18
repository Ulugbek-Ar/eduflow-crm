/// <reference types="vite/client" />

// Ilova o'qiydigan muhit o'zgaruvchilari (.env.example ga qarang). Hammasi ixtiyoriy
interface ImportMetaEnv {
  readonly VITE_SUPPORT_TELEGRAM?: string
  readonly VITE_SUPPORT_PHONE?: string
  readonly VITE_SUPPORT_EMAIL?: string
  // Huquqiy sahifalar (/privacy, /terms) uchun rekvizitlar
  readonly VITE_LEGAL_COMPANY?: string
  readonly VITE_LEGAL_ADDRESS?: string
  readonly VITE_LEGAL_DATA_LOCATION?: string
  readonly VITE_LEGAL_PAYMENT?: string
  readonly VITE_LEGAL_REFUND?: string
  readonly VITE_LEGAL_SUPPORT_HOURS?: string
  readonly VITE_OWNER_PASSWORD_HASH?: string
  readonly VITE_DEMO_ONLY?: string
  readonly VITE_MAIN_SITE_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
