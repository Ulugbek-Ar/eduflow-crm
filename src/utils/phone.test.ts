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

describe('telefon: eski uslub (8 / 0) va noto\'g\'ri uzun raqam (QA-01)', () => {
  it.each([
    ['8 93 111 22 33', '+998 93 111 22 33'],
    ['0931112233', '+998 93 111 22 33'],
    ['8-90-123-45-67', '+998 90 123 45 67'],
    ['93 111 22 33', '+998 93 111 22 33'],
    ['998931112233', '+998 93 111 22 33'],
    ['+998 (93) 111-22-33', '+998 93 111 22 33'],
    ['+998 8931112233', '+998 93 111 22 33'],
  ])('%s -> %s', (input, expected) => {
    expect(formatPhone(input)).toBe(expected)
    expect(isValidPhone(input)).toBe(true)
  })

  it('9 dan uzun tushunarsiz raqam kesilmaydi va noto\'g\'ri hisoblanadi', () => {
    expect(isValidPhone('93111223344')).toBe(false)
    expect(formatPhone('93111223344')).toBe('+998 93 111 22 3344')
    expect(isValidPhone('+998 93 111 22 33 4')).toBe(false)
    // 0 bilan boshlangan 9 raqam — operator kodi emas
    expect(isValidPhone('093111223')).toBe(false)
  })

  it('maydonda raqamma-raqam yozish: 10-raqamdan keyin to\'g\'ri raqamga aylanadi', () => {
    let value = ''
    for (const ch of '8931112233') value = formatPhone(value + ch)
    expect(value).toBe('+998 93 111 22 33')
  })
})
