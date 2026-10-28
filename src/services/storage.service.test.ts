// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../constants/mockData'
import { isCustomer, isSettings, isTransaction, sanitizeSettings } from '../utils/guards'
import { createBackup, getItem, inferCategory, loadData, parseBackup, readJson, SCHEMA_VERSION, setItem, STORAGE_KEYS } from './storage.service'

const validCustomer = {
  id: 'c1',
  name: 'Aziza Karimova',
  phone: '+998 90 123 45 67',
  course: 'Robototexnika',
  status: 'active',
  source: 'instagram',
  createdAt: '2026-05-01T10:00:00.000Z',
}

const v1Income = { id: 't1', type: 'income', amount: 650000, method: 'payme', note: 'IELTS', customerId: 'c1', date: '2026-10-01T10:00:00.000Z' }
const v1Expense = { id: 't2', type: 'expense', amount: 2000000, method: 'bank', note: 'Xona ijarasi', date: '2026-10-02T10:00:00.000Z' }

function seedV1(customers: unknown, transactions: unknown, settings: unknown = { orgName: 'Eski Markaz', currency: 'UZS', adminLogin: 'admin' }) {
  localStorage.setItem(STORAGE_KEYS.seeded, 'true')
  localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers))
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions))
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
}

beforeEach(() => {
  localStorage.clear()
})

describe('o\'qish va yozish', () => {
  it('buzuq JSON undefined qaytaradi, xato tashlamaydi', () => {
    localStorage.setItem(STORAGE_KEYS.customers, '{buzuq')
    expect(readJson(STORAGE_KEYS.customers)).toBeUndefined()
  })

  it('getItem: guard o\'tmasa standart qiymat', () => {
    const isNumber = (v: unknown): v is number => typeof v === 'number'
    localStorage.setItem(STORAGE_KEYS.version, '"matn"')
    expect(getItem(STORAGE_KEYS.version, 0, isNumber)).toBe(0)
    localStorage.setItem(STORAGE_KEYS.version, '2')
    expect(getItem(STORAGE_KEYS.version, 0, isNumber)).toBe(2)
  })

  it('bir xil qiymat qayta yozilmaydi (tablar orasida cheksiz sinxron bo\'lmasligi uchun)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    setItem('apex:test', { a: 1 })
    setItem('apex:test', { a: 1 })
    setItem('apex:test', { a: 2 })
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('loadData', () => {
  it('birinchi ishga tushishda demo ma\'lumot yozadi', () => {
    const { data, dropped } = loadData()
    expect(dropped).toBe(0)
    expect(data.customers).toHaveLength(15)
    expect(data.transactions.every(isTransaction)).toBe(true)
    expect(readJson(STORAGE_KEYS.version)).toBe(SCHEMA_VERSION)
  })

  it('v1 -> v2 migratsiya: kategoriya, sozlamalar standartlari, versiya', () => {
    seedV1([validCustomer], [v1Income, v1Expense])
    const { data, dropped } = loadData()
    expect(dropped).toBe(0)
    expect(data.transactions.map((t) => t.category)).toEqual(['course_fee', 'rent'])
    expect(data.settings).toMatchObject({ orgName: 'Eski Markaz', dateFormat: 'dd.mm.yyyy', csvDelimiter: ';' })
    expect(data.settings.courses).toContain('Robototexnika')
    expect(readJson(STORAGE_KEYS.version)).toBe(SCHEMA_VERSION)
    const stored = readJson(STORAGE_KEYS.transactions)
    expect(Array.isArray(stored) && stored.every(isTransaction)).toBe(true)
  })

  it('buzuq va takroriy yozuvlar tashlanadi, qolganlari saqlanadi', () => {
    seedV1(
      [validCustomer, { ...validCustomer, name: 'Dublikat' }, { id: 'x' }, { ...validCustomer, id: 'c2', status: 'vip' }, null, 'matn'],
      [
        v1Income,
        { ...v1Income, id: 't3', amount: -5 },
        { ...v1Income, id: 't4', category: 'rent' },
        { ...v1Income, id: 't5', date: 'kecha' },
      ],
    )
    const { data, dropped } = loadData()
    expect(data.customers.map((c) => c.name)).toEqual(['Aziza Karimova'])
    expect(data.transactions.map((t) => t.id)).toEqual(['t1'])
    expect(dropped).toBe(5 + 3)
  })

  it('massiv o\'rniga obyekt bo\'lsa bo\'sh ro\'yxat', () => {
    seedV1({ foo: 1 }, 'matn', 42)
    const { data } = loadData()
    expect(data.customers).toEqual([])
    expect(data.transactions).toEqual([])
    expect(data.settings.orgName).toBe('Apex Academy')
  })
})

describe('type guard\'lar', () => {
  it('isCustomer', () => {
    expect(isCustomer(validCustomer)).toBe(true)
    expect(isCustomer({ ...validCustomer, email: 5 })).toBe(false)
    expect(isCustomer({ ...validCustomer, name: '   ' })).toBe(false)
    expect(isCustomer({ ...validCustomer, status: 'toString' })).toBe(false)
  })

  it('isTransaction: kategoriya turi bilan mos bo\'lishi kerak', () => {
    const valid = { ...v1Income, category: 'course_fee' }
    expect(isTransaction(valid)).toBe(true)
    expect(isTransaction({ ...valid, category: 'rent' })).toBe(false)
    expect(isTransaction({ ...valid, amount: Number.NaN })).toBe(false)
    expect(isTransaction({ ...valid, amount: '650000' })).toBe(false)
  })

  it('isSettings', () => {
    expect(isSettings(DEFAULT_SETTINGS)).toBe(true)
    expect(isSettings({ ...DEFAULT_SETTINGS, csvDelimiter: '|' })).toBe(false)
    expect(isSettings({ ...DEFAULT_SETTINGS, courses: [''] })).toBe(false)
    expect(isSettings(sanitizeSettings({ currency: 'EUR' }))).toBe(true)
  })

  it('sanitizeSettings maydonma-maydon tuzatadi', () => {
    const settings = sanitizeSettings({ orgName: 'Markaz', currency: 'EUR', dateFormat: 'mm/dd', courses: ['A', '', 'A', 7, ' B '] })
    expect(settings.orgName).toBe('Markaz')
    expect(settings.currency).toBe('UZS')
    expect(settings.dateFormat).toBe('dd.mm.yyyy')
    expect(settings.courses).toEqual(['A', 'B'])
  })
})

describe('inferCategory', () => {
  it.each([
    ['Xona ijarasi', 'rent'],
    ['O\'qituvchilar maoshi', 'salary'],
    ['Instagram reklama', 'marketing'],
    ['Ofis jihozlari', 'equipment'],
    ['Elektr va internet', 'utilities'],
    ['Turli', 'other_expense'],
  ] as const)('chiqim "%s" -> %s', (note, expected) => {
    expect(inferCategory('expense', note)).toBe(expected)
  })

  it('kirim: mijoz bo\'lsa kurs to\'lovi', () => {
    expect(inferCategory('income', '', 'c1')).toBe('course_fee')
    expect(inferCategory('income', '')).toBe('other_income')
  })
})

describe('parseBackup', () => {
  it('JSON bo\'lmagan fayl', () => {
    expect(parseBackup('salom')).toMatchObject({ ok: false })
  })

  it('noto\'g\'ri tuzilma', () => {
    expect(parseBackup('{"foo": 1}')).toMatchObject({ ok: false })
    expect(parseBackup('[1, 2]')).toMatchObject({ ok: false })
  })

  it('yangiroq versiya rad etiladi', () => {
    expect(parseBackup(JSON.stringify({ version: 99, customers: [], transactions: [] }))).toMatchObject({ ok: false })
  })

  it('o\'z zaxirasini qayta o\'qiydi, buzuq yozuvlarni sanaydi', () => {
    const { data } = loadData()
    const backup = createBackup(data)
    const text = JSON.stringify({ ...backup, customers: [...backup.customers, { id: 'buzuq' }] })
    const result = parseBackup(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.customers).toHaveLength(15)
    expect(result.data.transactions).toHaveLength(data.transactions.length)
    expect(result.dropped).toBe(1)
    expect(result.exportedAt).toBe(backup.exportedAt)
  })

  it('1-bosqich (versiyasiz) zaxirasini migratsiya qiladi', () => {
    const result = parseBackup(JSON.stringify({ exportedAt: '2026-10-01', settings: {}, customers: [validCustomer], transactions: [v1Expense] }))
    expect(result.ok && result.data.transactions[0].category).toBe('rent')
  })
})
