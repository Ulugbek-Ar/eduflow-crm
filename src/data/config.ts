// Bulutli rejim: VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY berilgan bo'lsa ishlaydi. Bo'lmasa — lokal (brauzer) va demo
export interface CloudConfig {
  url: string
  anonKey: string
}

export function cloudConfig(env: Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY', string>> = import.meta.env): CloudConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!/^https:\/\/[^/]+/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) return null
  if (anonKey.length < 20) return null
  return { url: url.replace(/\/+$/, ''), anonKey }
}

export function isCloudEnabled(): boolean {
  return cloudConfig() !== null
}
