import { describe, expect, it } from 'vitest'
import type { Customer } from '../types/customer.types'
import { filterCustomers, sortCustomers, validateCustomer } from './customers'
import { paginate } from './list'
import { formatPhone, isValidPhone } from './phone'

const base: Customer = {
  id: 'c1',
  name: 'Aziza Karimova',
  phone: '+998 90 123 45 67',
  course: 'IELTS',
  status: 'active',
  source: 'instagram',
  createdAt: '2026-05-01T10:00:00.000Z',
}
const list: Customer[] = [
  base,
  { ...base, id: 'c2', name: 'Bekzod Ergashev', phone: '+998 97 678 90 12', status: 'lead', course: 'Python' },
  { ...base, id: 'c3', name: 'Otabek Nazarov', phone: '+998 88 890 12 34', status: 'left', source: 'website' },
]

describe('telefon maskasi', () => {
  it.each([
    ['901234567', '+998 90 123 45 67'],
    ['998901234567', '+998 90 123 45 67'],
    ['+998 90 12', '+998 90 12'],
    ['+998', '+998'],
    ['90123456789999', '+998 90 123 45 67'],
  ])('%s -> %s', (input, expected) => {
    expect(formatPhone(input)).toBe(expected)
  })

  it('isValidPhone', () => {
    expect(isValidPhone('+998 90 123 45 67')).toBe(true)
    expect(isValidPhone('+998 90 123')).toBe(false)
  })
})

describe('validateCustomer', () => {
  const input = { name: 'Yangi', phone: '+998 91 000 00 00', course: 'IELTS', status: 'lead', source: 'telegram' } as const

  it('to\'g\'ri ma\'lumotda xato yo\'q', () => {
    expect(validateCustomer({ ...input }, list)).toEqual({})
  })

  it('ism, telefon va email xatolari', () => {
    const errors = validateCustomer({ ...input, name: 'A', phone: '+998 9', email: 'xato@' }, list)
    expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'phone'])
  })

  it('takroriy telefon (formatidan qat\'i nazar), lekin o\'zini tahrirlashda emas', () => {
    expect(validateCustomer({ ...input, phone: '998901234567' }, list).phone).toContain('Aziza')
    expect(validateCustomer({ ...input, phone: '+998 90 123 45 67' }, list, 'c1')).toEqual({})
  })
})

describe('filtr, saralash, sahifalash', () => {
  it('telefon raqamlari bo\'yicha qidiruv', () => {
    expect(filterCustomers(list, '97 678', { status: 'all', course: 'all', source: 'all' }).map((c) => c.id)).toEqual(['c2'])
  })

  it('holat voronka tartibida saralanadi', () => {
    expect(sortCustomers(list, { key: 'status', direction: 'asc' }).map((c) => c.status)).toEqual(['lead', 'active', 'left'])
  })

  it('paginate chegaralarni qisadi', () => {
    const page = paginate(Array.from({ length: 37 }, (_, i) => i), 9, 10)
    expect(page).toMatchObject({ page: 4, pageCount: 4, from: 31, to: 37, total: 37 })
    expect(paginate([], 1, 10)).toMatchObject({ from: 0, to: 0, pageCount: 1 })
  })
})
