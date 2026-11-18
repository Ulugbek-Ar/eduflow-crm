import { describe, expect, it } from 'vitest'
import { formatPhone, isValidPhone, phoneDigits } from './phone'

describe('telefon: prefiksni o\'chirish (Backspace)', () => {
  it('"+99" va "+9" — bo\'sh raqam, "+998 99" ga aylanmaydi', () => {
    expect(phoneDigits('+99')).toBe('')
    expect(phoneDigits('+9')).toBe('')
    expect(formatPhone('+99')).toBe('+998')
    expect(isValidPhone('+99')).toBe(false)
  })

  it('prefiksdan keyingi raqamlar va prefikssiz yozish avvalgidek', () => {
    expect(phoneDigits('+998 9')).toBe('9')
    expect(formatPhone('99')).toBe('+998 99')
    expect(formatPhone('901234567')).toBe('+998 90 123 45 67')
    expect(formatPhone('+998901234567')).toBe('+998 90 123 45 67')
    expect(isValidPhone('+998 90 123 45 67')).toBe(true)
  })
})
