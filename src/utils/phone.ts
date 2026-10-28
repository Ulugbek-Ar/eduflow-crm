const COUNTRY_CODE = '998'
const LOCAL_LENGTH = 9

// Mahalliy 9 xonali raqam: "+998 90 123 45 67" -> "901234567"
export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith(COUNTRY_CODE)) digits = digits.slice(COUNTRY_CODE.length)
  return digits.slice(0, LOCAL_LENGTH)
}

// Kiritish paytida avtomatik maska: +998 XX XXX XX XX
export function formatPhone(value: string): string {
  const d = phoneDigits(value)
  let result = `+${COUNTRY_CODE}`
  if (d.length > 0) result += ` ${d.slice(0, 2)}`
  if (d.length > 2) result += ` ${d.slice(2, 5)}`
  if (d.length > 5) result += ` ${d.slice(5, 7)}`
  if (d.length > 7) result += ` ${d.slice(7, 9)}`
  return result
}

export function isValidPhone(value: string): boolean {
  return phoneDigits(value).length === LOCAL_LENGTH
}
