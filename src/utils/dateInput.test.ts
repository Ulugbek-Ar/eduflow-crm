import { describe, expect, it } from 'vitest'
import { datePlaceholder, maskDate, parseDisplayDate, toDisplayDate } from './dateInput'

describe('sana maydoni', () => {
  it('raqamlardan ajratgichli ko\'rinish yasaydi', () => {
    expect(maskDate('15112026', 'dd.mm.yyyy')).toBe('15.11.2026')
    expect(maskDate('1511', 'dd.mm.yyyy')).toBe('15.11')
    expect(maskDate('15.11.20269', 'dd.mm.yyyy')).toBe('15.11.2026')
    expect(maskDate('20261115', 'yyyy-mm-dd')).toBe('2026-11-15')
    expect(maskDate('ab', 'dd/mm/yyyy')).toBe('')
  })

  it('faqat to\'liq va haqiqiy sanani qabul qiladi', () => {
    expect(parseDisplayDate('15.11.2026', 'dd.mm.yyyy')).toBe('2026-11-15')
    expect(parseDisplayDate('15/11/2026', 'dd/mm/yyyy')).toBe('2026-11-15')
    expect(parseDisplayDate('2026-11-15', 'yyyy-mm-dd')).toBe('2026-11-15')
    expect(parseDisplayDate('31.02.2026', 'dd.mm.yyyy')).toBeNull()
    expect(parseDisplayDate('29.02.2028', 'dd.mm.yyyy')).toBe('2028-02-29')
    expect(parseDisplayDate('15.13.2026', 'dd.mm.yyyy')).toBeNull()
    expect(parseDisplayDate('15.11', 'dd.mm.yyyy')).toBeNull()
  })

  it('ichki qiymatdan ko\'rinish va ko\'rsatma', () => {
    expect(toDisplayDate('2026-11-05', 'dd.mm.yyyy')).toBe('05.11.2026')
    expect(toDisplayDate('', 'dd.mm.yyyy')).toBe('')
    expect(datePlaceholder('dd.mm.yyyy')).toBe('kk.oo.yyyy')
    expect(datePlaceholder('yyyy-mm-dd')).toBe('yyyy-oo-kk')
  })
})
