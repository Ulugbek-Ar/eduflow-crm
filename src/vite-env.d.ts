/// <reference types="vite/client" />

// Ilova o'qiydigan muhit o'zgaruvchilari (.env.example ga qarang). Hammasi ixtiyoriy
interface ImportMetaEnv {
  readonly VITE_SUPPORT_TELEGRAM?: string
  readonly VITE_SUPPORT_PHONE?: string
  readonly VITE_SUPPORT_EMAIL?: string
  readonly VITE_OWNER_PASSWORD_HASH?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
