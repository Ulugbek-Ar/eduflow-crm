// Tarjima: o'zbekcha matn — kalit. Rus lug'atida bo'lmasa o'zbekchasi qoladi (hech narsa bo'sh chiqmaydi).
// Til almashtirilganda sahifa qayta yuklanadi — modul darajasidagi yorliqlar ham yangi tilda hisoblanadi
export type Lang = 'uz' | 'ru'

export const LANG_KEY = 'apex:lang'
export const LANG_LABELS: Record<Lang, string> = { uz: 'O\'zbekcha', ru: 'Русский' }

let lang: Lang = 'uz'
let dict: Readonly<Record<string, string>> | null = null

export function readStoredLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === '"ru"' ? 'ru' : 'uz'
  } catch {
    return 'uz'
  }
}

export function getLang(): Lang {
  return lang
}

// Ilova yuklanishidan oldin (main.tsx): rus tili tanlangan bo'lsa lug'at alohida fayldan yuklanadi
export async function initI18n(): Promise<Lang> {
  lang = readStoredLang()
  if (lang === 'ru') {
    try {
      dict = (await import('./ru')).RU
    } catch {
      // Lug'at yuklanmasa — o'zbekcha
      lang = 'uz'
      dict = null
    }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  return lang
}

// Testlar uchun: lug'atni to'g'ridan-to'g'ri o'rnatish
export function setDictionary(next: Lang, entries: Readonly<Record<string, string>> | null): void {
  lang = next
  dict = entries
}

export function t(text: string, params?: Record<string, string | number>): string {
  const base = (dict && dict[text]) || text
  if (!params) return base
  return base.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match))
}

export function changeLang(next: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, JSON.stringify(next))
  } catch {
    // Saqlab bo'lmasa — til faqat shu safar o'zgarmaydi
    return
  }
  window.location.reload()
}

// Komponentlarda `t` nomi ko'p joyda tranzaksiya o'zgaruvchisi sifatida band — shuning uchun `tr`
export { t as tr }
