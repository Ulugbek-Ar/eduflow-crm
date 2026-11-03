import { describe, expect, it } from 'vitest'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { customerPayments, groupByStage, neighbourStage, deleteCustomerMessage, deletedCustomerName, filterCustomers, resolveCustomerName, sortCustomers, validateCustomer } from './customers'
import { paginate } from './list'
import { formatPhone, isValidPhone } from './phone'

const base: Customer = {
  id: 'c1',
  name: 'Aziza Karimova',
  phone: '+998 90 123 45 67',
  course: 'IELTS',
  status: 'paid',
  source: 'instagram',
  createdAt: '2026-05-01T10:00:00.000Z',
}
const list: Customer[] = [
  base,
  { ...base, id: 'c2', name: 'Bekzod Ergashev', phone: '+998 97 678 90 12', status: 'new', course: 'Python' },
  { ...base, id: 'c3', name: 'Otabek Nazarov', phone: '+998 88 890 12 34', status: 'cancelled', source: 'website' },
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
  const input = { name: 'Yangi', phone: '+998 91 000 00 00', course: 'IELTS', status: 'new', source: 'telegram' } as const

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
    expect(filterCustomers(list, '97 678', { status: 'all', course: 'all', source: 'all', from: '', to: '' }).map((c) => c.id)).toEqual(['c2'])
  })

  it('holat voronka tartibida saralanadi', () => {
    expect(sortCustomers(list, { key: 'status', direction: 'asc' }).map((c) => c.status)).toEqual(['new', 'paid', 'cancelled'])
  })

  it('paginate chegaralarni qisadi', () => {
    const page = paginate(Array.from({ length: 37 }, (_, i) => i), 9, 10)
    expect(page).toMatchObject({ page: 4, pageCount: 4, from: 31, to: 37, total: 37 })
    expect(paginate([], 1, 10)).toMatchObject({ from: 0, to: 0, pageCount: 1 })
  })
})

describe('mijozni o\'chirish va bog\'liq to\'lovlar', () => {
  const tx = (id: string, amount: number, type: Transaction['type'] = 'income', customerId: string | undefined = 'c1'): Transaction => ({
    id,
    type,
    amount,
    method: 'cash',
    category: type === 'income' ? 'course_fee' : 'rent',
    note: '',
    customerId,
    date: '2026-10-01T10:00:00.000Z',
  })
  const money = (amount: number) => `${amount} so'm`

  it('customerPayments: soni va jami kirim', () => {
    expect(customerPayments('c1', [tx('t1', 500), tx('t2', 300), tx('t3', 900, 'income', 'c2')])).toEqual({ count: 2, total: 800 })
  })

  it('tasdiqlash matnida to\'lovlar soni va summasi bor', () => {
    const message = deleteCustomerMessage(base, [tx('t1', 500), tx('t2', 300)], money)
    expect(message).toContain('2 ta to\'lov')
    expect(message).toContain('jami 800 so\'m')
    expect(message).toContain('"Aziza Karimova (o\'chirilgan)"')
  })

  it('to\'lov bo\'lmasa buni aytadi', () => {
    expect(deleteCustomerMessage(base, [], money)).toContain('to\'lovlar yo\'q')
  })

  it('resolveCustomerName: mavjud, o\'chirilgan va bog\'lanmagan', () => {
    expect(resolveCustomerName('c1', base, 'Eski')).toBe('Aziza Karimova')
    expect(resolveCustomerName('c1', undefined, 'Aziza Karimova')).toBe('Aziza Karimova (o\'chirilgan)')
    expect(resolveCustomerName('c1', undefined, undefined)).toBe(deletedCustomerName())
    expect(deletedCustomerName()).toBe('Mijoz (o\'chirilgan)')
    expect(resolveCustomerName(undefined, undefined, undefined)).toBe('—')
  })
})

describe('voronka', () => {
  it('filtr: qo\'shilgan sana oralig\'i (chegaralar kiradi)', () => {
    const dated = [
      { ...base, id: 'a', createdAt: new Date(2026, 9, 1, 9).toISOString() },
      { ...base, id: 'b', createdAt: new Date(2026, 9, 15, 23).toISOString() },
      { ...base, id: 'c', createdAt: new Date(2026, 9, 20, 9).toISOString() },
    ]
    const filters = { status: 'all', course: 'all', source: 'all', from: '2026-10-01', to: '2026-10-15' } as const
    expect(filterCustomers(dated, '', filters).map((c) => c.id)).toEqual(['a', 'b'])
    expect(filterCustomers(dated, '', { ...filters, from: '', to: '2026-10-01' }).map((c) => c.id)).toEqual(['a'])
    expect(filterCustomers(dated, '', { ...filters, from: '2026-10-16', to: '' }).map((c) => c.id)).toEqual(['c'])
  })

  it('groupByStage: har bosqich uchun ustun, bo\'shlari ham bor', () => {
    const groups = groupByStage(list, ['new', 'contacted', 'thinking', 'paid', 'cancelled'])
    expect(Object.keys(groups)).toEqual(['new', 'contacted', 'thinking', 'paid', 'cancelled'])
    expect(groups.new.map((c) => c.id)).toEqual(['c2'])
    expect(groups.contacted).toEqual([])
    expect(groups.paid.map((c) => c.id)).toEqual(['c1'])
  })

  it('neighbourStage: chetlarda null', () => {
    expect(neighbourStage('new', 1)).toBe('contacted')
    expect(neighbourStage('new', -1)).toBeNull()
    expect(neighbourStage('cancelled', 1)).toBeNull()
    expect(neighbourStage('paid', -1)).toBe('thinking')
  })
})
