const COUNTRY_CODE = '998'
const LOCAL_LENGTH = 9

// Mahalliy 9 xonali raqam: "+998 90 123 45 67" -> "901234567".
// Eski uslub: "8 93 111 22 33" va "0931112233" (10 raqam, boshida 8 yoki 0) -> "931112233".
// 9 dan uzun tushunarsiz raqam KESILMAYDI — noto'g'ri bo'lib qoladi (isValidPhone false, forma xato ko'rsatadi);
// avval birinchi 9 raqam olinardi va boshqa odamning raqami jim saqlanardi
export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '')
  // "+998" prefiksi Backspace bilan o'chirilayotganda ("+99", "+9") — bu raqam emas, prefiks qoldig'i.
  // Aks holda "+99" -> "+998 99" bo'lib, maydonni hech qachon tozalab bo'lmasdi
  if (value.trim().startsWith('+') && COUNTRY_CODE.startsWith(digits)) return ''
  if (digits.startsWith(COUNTRY_CODE)) digits = digits.slice(COUNTRY_CODE.length)
  if (digits.length === LOCAL_LENGTH + 1 && (digits.startsWith('8') || digits.startsWith('0'))) digits = digits.slice(1)
  return digits
}

// Kiritish paytida avtomatik maska: +998 XX XXX XX XX (ortiqcha raqamlar oxirida ko'rinib turadi — xato yashirilmaydi)
// previous — maydonning oldingi qiymati: 9 raqam to'lgach yozish to'xtaydi (QA-01b). Qo'yilgan (paste) uzun raqam esa
// kesilmaydi — noto'g'ri deb ko'rsatiladi (QA-01)
export function formatPhone(value: string, previous?: string): string {
  if (previous !== undefined && phoneDigits(previous).length === LOCAL_LENGTH && phoneDigits(value).length > LOCAL_LENGTH) return formatPhone(previous)
  const d = phoneDigits(value)
  let result = `+${COUNTRY_CODE}`
  if (d.length > 0) result += ` ${d.slice(0, 2)}`
  if (d.length > 2) result += ` ${d.slice(2, 5)}`
  if (d.length > 5) result += ` ${d.slice(5, 7)}`
  if (d.length > 7) result += ` ${d.slice(7, 9)}`
  if (d.length > LOCAL_LENGTH) result += d.slice(LOCAL_LENGTH)
  return result
}

export function isValidPhone(value: string): boolean {
  const digits = phoneDigits(value)
  return digits.length === LOCAL_LENGTH && /^[1-9]/.test(digits)
}
