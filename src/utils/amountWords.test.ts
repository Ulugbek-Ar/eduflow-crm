import { describe, expect, it } from 'vitest'
import { amountInWords, numberToWords } from './amountWords'

describe('summa so\'z bilan', () => {
  it('asosiy sonlar', () => {
    expect(numberToWords(0)).toBe('nol')
    expect(numberToWords(7)).toBe('yetti')
    expect(numberToWords(15)).toBe('o\'n besh')
    expect(numberToWords(40)).toBe('qirq')
    expect(numberToWords(105)).toBe('bir yuz besh')
    expect(numberToWords(999)).toBe('to\'qqiz yuz to\'qson to\'qqiz')
  })

  it('ming, million, milliard', () => {
    expect(numberToWords(1000)).toBe('bir ming')
    expect(numberToWords(650_000)).toBe('olti yuz ellik ming')
    expect(numberToWords(2_150_000)).toBe('ikki million bir yuz ellik ming')
    expect(numberToWords(1_000_001)).toBe('bir million bir')
    expect(numberToWords(3_000_000_000)).toBe('uch milliard')
  })

  it('valyuta bilan, bosh harf', () => {
    expect(amountInWords(650_000, 'UZS')).toBe('Olti yuz ellik ming so\'m')
    expect(amountInWords(120, 'USD')).toBe('Bir yuz yigirma AQSH dollari')
  })
})
