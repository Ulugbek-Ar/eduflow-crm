// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../constants/mockData'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import { isCustomer, isSettings, isTransaction, sanitizeSettings } from '../utils/guards'
import {
  combineResults,
  createBackup,
  createMockData,
  estimateStorageUsage,
  fillCustomerNames,
  getStorageUsage,
  getItem,
  inferCategory,
  isDemoMode,
  isFirstRun,
  isQuotaError,
  resetToMock,
  setDemoMode,
  startFresh,
  loadData,
  parseBackup,
  readJson,
  saveAll,
  saveErrorMessage,
  SCHEMA_VERSION,
  setItem,
  STORAGE_KEYS,
  STORAGE_LIMIT_BYTES,
  subscribeStorageUsage,
} from './storage.service'

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
  it('birinchi ishga tushishda hech narsa yozmaydi va bo\'sh ma\'lumot qaytaradi', () => {
    const { data, dropped } = loadData()
    expect(dropped).toBe(0)
    expect(data.customers).toEqual([])
    expect(data.transactions).toEqual([])
    expect(localStorage.length).toBe(0)
    expect(isFirstRun()).toBe(true)
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
    const data = createMockData()
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

describe('saqlash xatolari', () => {
  const quota = () => new DOMException('to\'ldi', 'QuotaExceededError')

  it('setItem muvaffaqiyatda ok qaytaradi', () => {
    expect(setItem('apex:test', [1, 2])).toEqual({ ok: true })
    expect(readJson('apex:test')).toEqual([1, 2])
  })

  it('xotira to\'lsa "quota" qaytaradi, xato tashlamaydi', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quota()
    })
    expect(setItem('apex:test', { a: 1 })).toEqual({ ok: false, reason: 'quota' })
  })

  it('boshqa xatolar "unavailable"', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloklangan', 'SecurityError')
    })
    expect(setItem('apex:test', 1)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('isQuotaError brauzerlarning turli nomlarini taniydi', () => {
    expect(isQuotaError(quota())).toBe(true)
    expect(isQuotaError(new DOMException('ff', 'NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true)
    expect(isQuotaError(new Error('QuotaExceededError'))).toBe(false)
  })

  it('saveAll birinchi xatoni qaytaradi', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quota()
    })
    expect(saveAll(createMockData())).toEqual({ ok: false, reason: 'quota' })
    expect(combineResults([{ ok: true }, { ok: false, reason: 'unavailable' }])).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('loadData migratsiyani saqlay olmasa saveError beradi', () => {
    seedV1([validCustomer], [v1Income])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quota()
    })
    const result = loadData()
    expect(result.saveError).toBe('quota')
    expect(result.data.customers).toHaveLength(1)
  })

  it('xato matni foydalanuvchiga tushunarli', () => {
    expect(saveErrorMessage('quota')).toBe('Ma\'lumot saqlanmadi: brauzer xotirasi to\'lgan. JSON zaxira oling.')
  })

  it('estimateStorageUsage UTF-16 bo\'yicha baytlarni hisoblaydi', () => {
    localStorage.setItem('ab', 'cdef')
    const usage = estimateStorageUsage()
    expect(usage.bytes).toBe(12)
    expect(usage.percent).toBeCloseTo((12 / STORAGE_LIMIT_BYTES) * 100)
  })

  it('getStorageUsage keshlanadi va yozuvdan keyin obunachiga xabar beradi', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeStorageUsage(listener)
    const before = getStorageUsage()
    expect(getStorageUsage()).toBe(before)
    setItem('apex:test', 'katta qiymat')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getStorageUsage().bytes).toBeGreaterThan(before.bytes)
    unsubscribe()
  })
})

describe('birinchi ishga tushish va demo rejim', () => {
  it('"Bo\'sh boshlash": bo\'sh baza, demo rejim o\'chiq', () => {
    expect(startFresh('empty')).toEqual({ ok: true })
    expect(isFirstRun()).toBe(false)
    expect(isDemoMode()).toBe(false)
    const { data } = loadData()
    expect(data.customers).toEqual([])
    expect(data.transactions).toEqual([])
    expect(readJson(STORAGE_KEYS.version)).toBe(SCHEMA_VERSION)
  })

  it('"Demo ma\'lumot": namunaviy ma\'lumot yoziladi va demo bayrog\'i qo\'yiladi', () => {
    startFresh('demo')
    expect(isDemoMode()).toBe(true)
    const { data } = loadData()
    expect(data.customers).toHaveLength(15)
    expect(data.transactions.every(isTransaction)).toBe(true)
  })

  it('tanlov allaqachon qilingan bo\'lsa, mavjud ma\'lumot ustidan yozilmaydi', () => {
    startFresh('empty')
    localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify([validCustomer]))
    startFresh('demo')
    expect(isDemoMode()).toBe(false)
    expect(loadData().data.customers).toHaveLength(1)
  })

  it('mavjud foydalanuvchida (apex:seeded === true) hech narsa o\'zgarmaydi', () => {
    localStorage.setItem(STORAGE_KEYS.seeded, 'true')
    localStorage.setItem(STORAGE_KEYS.version, String(SCHEMA_VERSION))
    localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify([validCustomer]))
    localStorage.setItem(STORAGE_KEYS.transactions, '[]')
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(DEFAULT_SETTINGS))
    const snapshot = { ...localStorage }
    expect(isFirstRun()).toBe(false)
    expect(isDemoMode()).toBe(false)
    expect(loadData().data.customers).toHaveLength(1)
    expect({ ...localStorage }).toEqual(snapshot)
  })

  it('demo rejim bayrog\'i: resetToMock yoqadi, setDemoMode(false) o\'chiradi', () => {
    resetToMock()
    expect(isDemoMode()).toBe(true)
    setDemoMode(false)
    expect(isDemoMode()).toBe(false)
  })
})

describe('v2 -> v3: mijoz nomi snapshot\'i', () => {
  const v2Income = { ...v1Income, category: 'course_fee' }

  it('mavjud mijozlar nomi tranzaksiyalarga ko\'chiriladi va versiya 3 bo\'ladi', () => {
    seedV1([validCustomer], [v2Income, { ...v2Income, id: 't9', customerId: 'yoq' }, v1Expense])
    localStorage.setItem(STORAGE_KEYS.version, '2')
    const { data } = loadData()
    expect(SCHEMA_VERSION).toBe(3)
    expect(data.transactions.map((t) => t.customerName)).toEqual(['Aziza Karimova', undefined, undefined])
    expect(readJson(STORAGE_KEYS.version)).toBe(3)
    const stored = readJson(STORAGE_KEYS.transactions) as Array<{ customerName?: string }>
    expect(stored[0].customerName).toBe('Aziza Karimova')
  })

  it('mavjud snapshot ustidan yozilmaydi', () => {
    const tx = { ...v2Income, customerName: 'Eski ism' } as Transaction
    expect(fillCustomerNames([tx], [validCustomer as Customer])[0].customerName).toBe('Eski ism')
  })

  it('guard: customerName ixtiyoriy satr', () => {
    expect(isTransaction({ ...v2Income, customerName: 'Aziza' })).toBe(true)
    expect(isTransaction({ ...v2Income, customerName: 42 })).toBe(false)
  })

  it('v2 zaxirasi ham migratsiya qilinadi', () => {
    const result = parseBackup(JSON.stringify({ version: 2, settings: {}, customers: [validCustomer], transactions: [v2Income] }))
    expect(result.ok && result.data.transactions[0].customerName).toBe('Aziza Karimova')
  })
})
