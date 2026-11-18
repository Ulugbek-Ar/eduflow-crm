// Qidiruv uchun matnni bir xil ko'rinishga keltirish: kichik harf, o'zbekcha apostrof turlari (ʻ ʼ ' ‘ ’ ʹ ` ´)
// olib tashlanadi — "G'ulom", "Gʻulom", "G‘ulom" va "gulom" bir xil topiladi; ortiqcha bo'sh joylar siqiladi
const APOSTROPHES = /['‘’ʻʼʹ`´]/g

export function normalizeSearch(text: string): string {
  return text.toLowerCase().replace(APOSTROPHES, '').replace(/\s+/g, ' ').trim()
}

// haystack ichida needle bormi (ikkalasi ham normallashtiriladi). Bo'sh so'rov — hammasi mos
export function searchIncludes(haystack: string, needle: string): boolean {
  const query = normalizeSearch(needle)
  return !query || normalizeSearch(haystack).includes(query)
}

// So'rov faqat raqam va telefon belgilaridan iborat bo'lsa (kamida 3 raqam) — raqamlari; aks holda ''
// "931112233", "+998 93 111", "(93) 111-22" -> raqamlar bo'yicha qidiruv
export function phoneQuery(needle: string): string {
  if (/[^\d\s+()-]/.test(needle)) return ''
  const digits = needle.replace(/\D/g, '')
  return digits.length >= 3 ? digits : ''
}
