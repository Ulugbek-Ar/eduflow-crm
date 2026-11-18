// Server yig'masi (engine.js) uchun i18n o'rinbosari: tarjima lug'ati va brauzer API'lari yo'q, matn o'zbekcha qoladi.
// Imzo src/i18n/index.ts dagi tr() bilan bir xil
export type Lang = 'uz' | 'ru'

export function tr(text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match))
}

export const t = tr

export function getLang(): Lang {
  return 'uz'
}
