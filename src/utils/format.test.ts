import { describe, expect, it } from 'vitest'
import { formatAmountInput, formatCompact, formatDateWith, formatMoney, formatPercent, parseAmount, toInputDate } from './format'

// Intl bo'shliq sifatida NBSP qaytarishi mumkin — solishtirishdan oldin oddiy bo'shliqqa keltiramiz
const plain = (value: string) => value.replace(/\s/g, ' ')

describe('formatMoney', () => {
  it('so\'mni minglik ajratgich bilan chiqaradi', () => {
    expect(plain(formatMoney(1_200_000, 'UZS'))).toBe('1 200 000 so\'m')
    expect(plain(formatMoney(0, 'UZS'))).toBe('0 so\'m')
  })

  it('dollarni AQSH formatida chiqaradi', () => {
    expect(formatMoney(1500, 'USD')).toBe('$1,500')
  })

  it('manfiy qiymatni ishorasi bilan chiqaradi', () => {
    expect(plain(formatMoney(-380_000, 'UZS'))).toMatch(/^-380 000 so'm$/)
  })
})

describe('formatCompact', () => {
  it.each([
    [1_500_000, '1,5 mln'],
    [2_000_000, '2 mln'],
    [650_000, '650 ming'],
    [2_500_000_000, '2,5 mlrd'],
    [999, '999'],
    [0, '0'],
    [-2_000_000, '−2 mln'],
  ])('%d -> %s', (value, expected) => {
    expect(formatCompact(value)).toBe(expected)
  })
})

describe('formatPercent', () => {
  it('bitta kasr xonasi bilan', () => {
    expect(formatPercent(12.345)).toBe('12,3%')
    expect(formatPercent(150)).toBe('150,0%')
  })
})

describe('formatDateWith', () => {
  const iso = new Date(2026, 0, 5, 10, 30).toISOString()

  it.each([
    ['dd.mm.yyyy', '05.01.2026'],
    ['dd/mm/yyyy', '05/01/2026'],
    ['yyyy-mm-dd', '2026-01-05'],
  ] as const)('%s', (format, expected) => {
    expect(formatDateWith(iso, format)).toBe(expected)
  })

  it('noto\'g\'ri sana uchun tire qaytaradi', () => {
    expect(formatDateWith('buzuq', 'dd.mm.yyyy')).toBe('—')
  })
})

describe('summa maydoni', () => {
  it('faqat raqamlarni qoldirib, minglik ajratadi', () => {
    expect(formatAmountInput('0001200000abc')).toBe('1 200 000')
    expect(formatAmountInput('650 000')).toBe('650 000')
    expect(formatAmountInput('')).toBe('')
  })

  it('juda uzun kiritishni 13 xonada kesadi', () => {
    expect(formatAmountInput('12345678901234567').replace(/\s/g, '')).toHaveLength(13)
  })

  it('parseAmount', () => {
    expect(parseAmount('1 200 000')).toBe(1_200_000)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })

  it('toInputDate mahalliy sana bo\'yicha', () => {
    expect(toInputDate(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05')
  })
})
