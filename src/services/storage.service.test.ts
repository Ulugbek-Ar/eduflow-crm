// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../constants/mockData'
import { createMockData } from './demo/data'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import { computeDebts } from '../utils/debts'
import type { Transaction } from '../types/finance.types'
import { isCourse, isCustomer, isSettings, isTransaction, sanitizeSettings } from '../utils/guards'
import {
  combineResults,
  createBackup,
  estimateStorageUsage,
  fillCustomerNames,
  fillPaidAt,
  fixLegacyCourseDuration,
  getStorageUsage,
  getItem,
  inferCategory,
  isDemoMode,
  isFirstRun,
  isQuotaError,
  LEGACY_METHOD_MAP,
  LEGACY_STATUS_MAP,
  resetToMock,
  setDemoMode,
  startFresh,
  loadData,
  migrateStudentsToGroups,
  normalizeData,
  parseBackup,
  readPreMigrationBackup,
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
    expect(data.courses.map((c) => c.name)).toContain('Robototexnika')
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
    expect(data.settings).toMatchObject({ orgName: 'EduFlow Academy', logoText: 'EA' })
  })
})

describe('type guard\'lar', () => {
  it('isCustomer', () => {
    expect(isCustomer(validCustomer)).toBe(false)
    expect(isCustomer({ ...validCustomer, status: 'paid' })).toBe(true)
    expect(isCustomer({ ...validCustomer, email: 5 })).toBe(false)
    expect(isCustomer({ ...validCustomer, name: '   ' })).toBe(false)
    expect(isCustomer({ ...validCustomer, status: 'toString' })).toBe(false)
  })

  it('isTransaction: kategoriya turi bilan mos bo\'lishi kerak', () => {
    const valid = { ...v1Income, method: 'card', status: 'paid', category: 'course_fee' }
    expect(isTransaction(valid)).toBe(true)
    expect(isTransaction({ ...valid, category: 'rent' })).toBe(false)
    expect(isTransaction({ ...valid, amount: Number.NaN })).toBe(false)
    expect(isTransaction({ ...valid, amount: '650000' })).toBe(false)
  })

  it('isSettings', () => {
    expect(isSettings(DEFAULT_SETTINGS)).toBe(true)
    expect(isSettings({ ...DEFAULT_SETTINGS, csvDelimiter: '|' })).toBe(false)
    expect(isSettings(sanitizeSettings({ currency: 'EUR' }))).toBe(true)
  })

  it('sanitizeSettings maydonma-maydon tuzatadi', () => {
    const settings = sanitizeSettings({ orgName: 'Markaz', currency: 'EUR', dateFormat: 'mm/dd' })
    expect(settings.orgName).toBe('Markaz')
    expect(settings.currency).toBe('UZS')
    expect(settings.dateFormat).toBe('dd.mm.yyyy')
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
    expect(result.data.customers).toHaveLength(data.customers.length)
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
    startFresh('demo', createMockData())
    expect(isDemoMode()).toBe(true)
    const { data, dropped } = loadData()
    expect(dropped).toBe(0)
    expect(data.customers.length).toBeGreaterThan(100)
    expect(data.transactions.every(isTransaction)).toBe(true)
  })

  it('tanlov allaqachon qilingan bo\'lsa, mavjud ma\'lumot ustidan yozilmaydi', () => {
    startFresh('empty')
    localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify([validCustomer]))
    startFresh('demo', createMockData())
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
    resetToMock(createMockData())
    expect(isDemoMode()).toBe(true)
    setDemoMode(false)
    expect(isDemoMode()).toBe(false)
  })
})

describe('v2 -> v3: mijoz nomi snapshot\'i', () => {
  const v2Income = { ...v1Income, method: 'card', status: 'paid', category: 'course_fee' }

  it('mavjud mijozlar nomi tranzaksiyalarga ko\'chiriladi va versiya yangilanadi', () => {
    seedV1([validCustomer], [v2Income, { ...v2Income, id: 't9', customerId: 'yoq' }, v1Expense])
    localStorage.setItem(STORAGE_KEYS.version, '2')
    const { data } = loadData()
    expect(data.transactions.map((t) => t.customerName)).toEqual(['Aziza Karimova', undefined, undefined])
    expect(readJson(STORAGE_KEYS.version)).toBe(SCHEMA_VERSION)
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

describe('v3 -> v4: profil maydonlari', () => {
  it('eski sozlamalarga standart profil qo\'shiladi, mavjud qiymat saqlanadi', () => {
    expect(sanitizeSettings({ orgName: 'Markaz' })).toMatchObject({ profileName: '', profileRole: 'Administrator' })
    expect(sanitizeSettings({ profileName: '  Dilshod Karimov ', profileRole: 'Direktor' })).toMatchObject({
      profileName: 'Dilshod Karimov',
      profileRole: 'Direktor',
    })
    expect(isSettings(sanitizeSettings({}))).toBe(true)
    expect(isSettings({ ...sanitizeSettings({}), profileRole: 5 })).toBe(false)
  })
})

describe('v4 -> v5: voronka bosqichlari', () => {
  it('eski holatlar xarita bo\'yicha ko\'chiriladi', () => {
    expect(LEGACY_STATUS_MAP).toEqual({ lead: 'new', active: 'paid', paused: 'thinking', left: 'cancelled' })
    const old = ['lead', 'active', 'paused', 'left'].map((status, i) => ({ ...validCustomer, id: `c${i}`, phone: `+998 90 000 00 0${i}`, status }))
    seedV1(old, [])
    const { data, dropped } = loadData()
    expect(dropped).toBe(0)
    expect(data.customers.map((c) => c.status)).toEqual(['new', 'paid', 'thinking', 'cancelled'])
    expect((readJson(STORAGE_KEYS.customers) as Array<{ status: string }>).map((c) => c.status)).toEqual(['new', 'paid', 'thinking', 'cancelled'])
  })

  it('yangi bosqichlar o\'zgarmaydi, noma\'lum holat buzuq hisoblanadi', () => {
    seedV1([{ ...validCustomer, status: 'contacted' }, { ...validCustomer, id: 'c9', phone: '+998 90 999 99 99', status: 'vip' }], [])
    const { data, dropped } = loadData()
    expect(data.customers.map((c) => c.status)).toEqual(['contacted'])
    expect(dropped).toBe(1)
  })

  it('eski (v2) JSON zaxira ham yangi bosqichlar bilan ochiladi', () => {
    const result = parseBackup(JSON.stringify({ version: 2, customers: [validCustomer], transactions: [] }))
    expect(result.ok && result.data.customers[0].status).toBe('paid')
  })
})

describe('v5 -> v6: kurslar entity', () => {
  it('settings.courses va mijozlardagi nomlar kursga aylanadi (narx 0), sozlamalardan olib tashlanadi', () => {
    seedV1([validCustomer], [], { orgName: 'Markaz', courses: ['IELTS', ' ielts ', 'Python', 7] })
    const { data } = loadData()
    expect(data.courses.map((c) => c.name)).toEqual(['IELTS', 'Python', 'Robototexnika'])
    expect(data.courses.every(isCourse)).toBe(true)
    // Davomiylik noma'lum — muddatsiz (0)
    expect(data.courses[0]).toMatchObject({ type: 'course', durationMonths: 0, monthlyPrice: 0, status: 'active' })
    expect(readJson(STORAGE_KEYS.courses)).toHaveLength(3)
    expect(readJson(STORAGE_KEYS.settings)).not.toHaveProperty('courses')
  })

  it('saqlangan kurslar tekshiriladi: buzuq va takroriy nomlar tashlanadi', () => {
    seedV1([], [])
    const good = { id: 'k1', name: 'IELTS', type: 'course', durationMonths: 6, monthlyPrice: 650000, activeGroups: 2, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }
    localStorage.setItem(STORAGE_KEYS.courses, JSON.stringify([good, { ...good, id: 'k2', name: 'ielts' }, { ...good, id: 'k3', monthlyPrice: -5 }]))
    const { data, dropped } = loadData()
    expect(data.courses.map((c) => c.id)).toEqual(['k1'])
    expect(dropped).toBe(2)
  })

  it('kurslarsiz eski zaxira migratsiya qilinadi, yangi zaxira kurslarni saqlaydi', () => {
    const old = parseBackup(JSON.stringify({ version: 5, settings: { courses: ['IELTS'] }, customers: [], transactions: [] }))
    expect(old.ok && old.data.courses.map((c) => c.name)).toEqual(['IELTS'])
    const backup = createBackup(createMockData())
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.ok && restored.data.courses).toEqual(backup.courses)
  })

  it('demo ma\'lumotda narxli kurslar, xizmat va arxivdagi kurs bor', () => {
    const { courses } = createMockData()
    expect(courses.every(isCourse)).toBe(true)
    expect(courses.some((c) => c.type === 'service')).toBe(true)
    expect(courses.some((c) => c.status === 'archived')).toBe(true)
    expect(courses.filter((c) => c.status === 'active').every((c) => c.monthlyPrice > 0)).toBe(true)
  })
})

describe('v6 -> v7: to\'lov turi va status', () => {
  it('payme, click -> card; bank -> transfer; cash o\'zgarmaydi; status "To\'langan"', () => {
    expect(LEGACY_METHOD_MAP).toEqual({ payme: 'card', click: 'card', bank: 'transfer' })
    const methods = ['payme', 'click', 'bank', 'cash']
    seedV1([validCustomer], methods.map((method, i) => ({ ...v1Income, id: `t${i}`, method })))
    const { data, dropped } = loadData()
    expect(dropped).toBe(0)
    expect(data.transactions.map((t) => t.method)).toEqual(['card', 'card', 'transfer', 'cash'])
    expect(data.transactions.every((t) => t.status === 'paid')).toBe(true)
    expect(readJson(STORAGE_KEYS.version)).toBe(SCHEMA_VERSION)
  })

  it('guard: status majburiy, manba faqat marketing chiqimida', () => {
    const tx = { ...v1Expense, method: 'card', status: 'paid', category: 'marketing' }
    expect(isTransaction({ ...tx, source: 'instagram' })).toBe(true)
    expect(isTransaction({ ...tx, source: 'tv' })).toBe(false)
    expect(isTransaction({ ...tx, category: 'rent', source: 'instagram' })).toBe(false)
    expect(isTransaction({ ...tx, status: 'done' })).toBe(false)
    expect(isTransaction({ ...tx, method: 'payme' })).toBe(false)
  })

  it('demo ma\'lumotda kutilayotgan, bekor qilingan va manbali marketing chiqimlari bor', () => {
    const { transactions } = createMockData()
    expect(transactions.every(isTransaction)).toBe(true)
    expect(transactions.some((t) => t.status === 'pending')).toBe(true)
    expect(transactions.some((t) => t.status === 'cancelled')).toBe(true)
    expect(new Set(transactions.filter((t) => t.source).map((t) => t.source))).toEqual(new Set(['instagram', 'telegram', 'website']))
  })
})

describe('v7 -> v8: logotip rasmi', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='

  it('to\'g\'ri data URL saqlanadi; boshqa, buzuq yoki 200 KB dan katta qiymat olib tashlanadi', () => {
    expect(sanitizeSettings({}).logoImage).toBe('')
    expect(sanitizeSettings({ logoImage: png }).logoImage).toBe(png)
    expect(sanitizeSettings({ logoImage: 'https://misol.uz/logo.png' }).logoImage).toBe('')
    expect(sanitizeSettings({ logoImage: 'data:text/html;base64,PHNjcmlwdD4=' }).logoImage).toBe('')
    expect(sanitizeSettings({ logoImage: `data:image/png;base64,${'A'.repeat(300_000)}` }).logoImage).toBe('')
    expect(isSettings({ ...sanitizeSettings({}), logoImage: 'javascript:alert(1)' })).toBe(false)
  })

  it('logotip JSON zaxiraga kiradi va qayta tiklanadi', () => {
    const data = createMockData()
    const backup = createBackup({ ...data, settings: { ...data.settings, logoImage: png } })
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.ok && restored.data.settings.logoImage).toBe(png)
  })
})

describe('v8 -> v9: "To\'lov qildi" sanasi (paidAt)', () => {
  it('to\'lov qilgan mijozga birinchi to\'langan kirim sanasi, to\'lovi bo\'lmasa qo\'shilgan sana; boshqalarda yo\'q', () => {
    const customers = [
      { ...validCustomer, id: 'a', phone: '+998 90 000 00 01', status: 'paid' },
      { ...validCustomer, id: 'b', phone: '+998 90 000 00 02', status: 'paid' },
      { ...validCustomer, id: 'c', phone: '+998 90 000 00 03', status: 'new', paidAt: '2026-05-01T00:00:00.000Z' },
    ]
    const pay = (id: string, customerId: string, date: string, status = 'paid') => ({ ...v1Income, id, customerId, date, method: 'card', status, category: 'course_fee' })
    seedV1(customers, [pay('t1', 'a', '2026-07-10T10:00:00.000Z'), pay('t2', 'a', '2026-06-02T10:00:00.000Z'), pay('t3', 'a', '2026-05-01T10:00:00.000Z', 'pending')])
    const { data } = loadData()
    expect(data.customers.map((c) => c.paidAt)).toEqual(['2026-06-02T10:00:00.000Z', validCustomer.createdAt, undefined])
    expect(readJson(STORAGE_KEYS.version)).toBe(SCHEMA_VERSION)
  })

  it('guard: paidAt ixtiyoriy ISO sana; mavjud qiymat o\'zgarmaydi', () => {
    expect(isCustomer({ ...validCustomer, status: 'paid', paidAt: 'kecha' })).toBe(false)
    const kept = fillPaidAt([{ ...validCustomer, status: 'paid', paidAt: '2026-02-02T00:00:00.000Z' } as Customer], [])
    expect(kept[0].paidAt).toBe('2026-02-02T00:00:00.000Z')
  })

  it('demo ma\'lumotda to\'lov qilgan har bir mijozda paidAt bor', () => {
    const { customers } = createMockData()
    expect(customers.filter((c) => c.status === 'paid').every((c) => c.paidAt)).toBe(true)
    expect(customers.filter((c) => c.status !== 'paid').some((c) => c.paidAt)).toBe(false)
  })
})

describe('v9 -> v10: kurs davomiyligi "muddatsiz"', () => {
  const legacy = { id: 'k1', name: 'IELTS', type: 'course', durationMonths: 1, monthlyPrice: 0, activeGroups: 0, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }

  it('v6 migratsiyasining "1 oy, narx 0" kurslari muddatsiz bo\'ladi; boshqa kurslar o\'zgarmaydi', () => {
    seedV1([], [])
    localStorage.setItem(STORAGE_KEYS.version, '9')
    localStorage.setItem(STORAGE_KEYS.courses, JSON.stringify([legacy, { ...legacy, id: 'k2', name: 'Python', monthlyPrice: 900000 }, { ...legacy, id: 'k3', name: 'Konsultatsiya', type: 'service' }]))
    const { data } = loadData()
    expect(data.courses.map((c) => c.durationMonths)).toEqual([0, 1, 1])
    expect(readJson(STORAGE_KEYS.version)).toBe(SCHEMA_VERSION)
  })

  it('v10 va undan yangi ma\'lumotda haqiqiy 1 oylik kursga tegilmaydi', () => {
    expect(fixLegacyCourseDuration([legacy as Course], 10)[0].durationMonths).toBe(1)
    expect(fixLegacyCourseDuration([legacy as Course], 9)[0].durationMonths).toBe(0)
  })

  it('muddatsiz kursda qarzdor yashirinib qolmaydi (kurs tugadi deb hisoblanmaydi)', () => {
    const paidLongAgo = { ...validCustomer, status: 'paid', paidAt: '2025-01-05T10:00:00.000Z', course: 'IELTS' } as Customer
    const rows = computeDebts([paidLongAgo], [{ ...(legacy as Course), durationMonths: 0, monthlyPrice: 650000 }], [])
    expect(rows).toHaveLength(1)
    expect(rows[0].debt).toBe(650000)
  })
})

describe('v10 -> v11: guruhlar, o\'qish, davomat', () => {
  // v10 dagi haqiqiy ko'rinish: kursda activeGroups bor, guruh/o'qish kalitlari yo'q
  const v10Courses = [
    { id: 'k1', name: 'IELTS', type: 'course', durationMonths: 6, monthlyPrice: 650_000, activeGroups: 3, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'k2', name: 'Python', type: 'course', durationMonths: 4, monthlyPrice: 900_000, activeGroups: 1, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'k3', name: 'Rus tili', type: 'course', durationMonths: 6, monthlyPrice: 450_000, activeGroups: 0, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
  ]
  const student = (id: string, course: string, paidAt: string, status = 'paid') => ({
    id,
    name: `O'quvchi ${id}`,
    phone: `+998 90 000 00 ${id.slice(-2).padStart(2, '0')}`,
    course,
    status,
    source: 'instagram',
    createdAt: '2026-08-01T10:00:00.000Z',
    ...(status === 'paid' ? { paidAt } : {}),
  })
  const v10Customers = [
    student('c1', 'IELTS', '2026-09-10T10:00:00.000Z'),
    student('c2', 'IELTS', '2026-08-15T12:00:00.000Z'),
    student('c3', 'Python', '2026-10-01T09:00:00.000Z'),
    student('c4', 'Python', '', 'new'),
    student('c5', 'Rus tili', '', 'cancelled'),
  ]

  function seedV10() {
    seedV1(v10Customers, [], { ...DEFAULT_SETTINGS })
    localStorage.setItem(STORAGE_KEYS.courses, JSON.stringify(v10Courses))
    localStorage.setItem(STORAGE_KEYS.version, '10')
  }

  it('"To\'lov qildi" o\'quvchilari kurs bo\'yicha "{Kurs} — 1-guruh"ga yoziladi (Du/Cho/Ju, 14:00–15:30, o\'qituvchisiz)', () => {
    seedV10()
    const { data, dropped } = loadData()
    expect(dropped).toBe(0)
    expect(readJson(STORAGE_KEYS.version)).toBe(SCHEMA_VERSION)
    expect(data.groups.map((g) => g.name).sort()).toEqual(['IELTS — 1-guruh', 'Python — 1-guruh'])
    const ielts = data.groups.find((g) => g.courseId === 'k1')
    expect(ielts).toMatchObject({ days: ['mon', 'wed', 'fri'], startTime: '14:00', endTime: '15:30', startDate: '2026-08-15', status: 'active', room: '' })
    expect(ielts?.teacherId).toBeUndefined()
    // Har o'quvchiga paidAt dan boshlanadigan o'qish; lid va bekor qilinganlar yozilmaydi
    expect(data.enrollments.map((e) => [e.customerId, e.groupId, e.startDate, e.status])).toEqual([
      ['c1', ielts?.id, '2026-09-10', 'active'],
      ['c2', ielts?.id, '2026-08-15', 'active'],
      ['c3', data.groups.find((g) => g.courseId === 'k2')?.id, '2026-10-01', 'active'],
    ])
    // Course.activeGroups olib tashlandi
    expect(data.courses.every((c) => !('activeGroups' in c))).toBe(true)
    expect((readJson(STORAGE_KEYS.courses) as object[]).every((c) => !('activeGroups' in c))).toBe(true)
  })

  it('migratsiyadan oldin avtomatik JSON zaxira saqlanadi (bir marta)', () => {
    seedV10()
    loadData()
    const backup = readPreMigrationBackup()
    expect(backup).toMatchObject({ app: 'eduflow-crm', version: 10 })
    const courses = backup?.courses as Array<{ activeGroups: number }> | undefined
    expect(courses?.[0]?.activeGroups).toBe(3)
    expect(backup?.customers).toHaveLength(5)
    // Zaxira oddiy JSON zaxira sifatida tiklanadi
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.ok && restored.data.enrollments).toHaveLength(3)
  })

  it('idempotent: qayta yuklash va qayta migratsiya hech narsani takrorlamaydi', () => {
    seedV10()
    const first = loadData().data
    const second = loadData().data
    expect(second.groups).toEqual(first.groups)
    expect(second.enrollments).toEqual(first.enrollments)
    const again = migrateStudentsToGroups(first.customers, first.courses, first.groups, first.enrollments)
    expect(again.groups).toEqual(first.groups)
    expect(again.enrollments).toEqual(first.enrollments)
    // v10 ma'lumotiga ikki marta qo'llansa ham natija bir xil
    const raw = { customers: v10Customers, transactions: [], settings: {}, courses: v10Courses }
    const a = normalizeData(raw, 10).data
    const b = normalizeData({ ...raw, groups: a.groups, enrollments: a.enrollments }, 10).data
    expect(b.groups.map((g) => g.id)).toEqual(a.groups.map((g) => g.id))
    expect(b.enrollments.map((e) => e.id)).toEqual(a.enrollments.map((e) => e.id))
  })

  it('v11 ma\'lumoti: buzuq guruh/o\'qish/davomat tashlanadi, davomat (guruh, o\'quvchi, sana) bo\'yicha noyob', () => {
    const group = { id: 'g1', name: 'IELTS', courseId: 'k1', room: '', days: ['mon'], startTime: '09:00', endTime: '10:30', capacity: 12, startDate: '2026-09-01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' }
    const mark = { id: 'd1', groupId: 'g1', customerId: 'c1', date: '2026-11-02', status: 'present', updatedAt: '2026-11-02T10:00:00.000Z' }
    const { data, dropped } = normalizeData({
      customers: [],
      transactions: [],
      settings: {},
      courses: [],
      groups: [group, { ...group, id: 'g2', endTime: '08:00' }, { ...group, id: 'g3', days: [] }],
      enrollments: [{ id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-13-01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' }],
      attendance: [mark, { ...mark, id: 'd2', status: 'absent', updatedAt: '2026-11-02T11:00:00.000Z' }, { ...mark, id: 'd3', status: 'sick' }],
      teachers: [{ id: 'p1', name: 'X', phone: '', subjects: [], payRule: { type: 'percent', percent: 140 }, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }],
    })
    expect(data.groups.map((g) => g.id)).toEqual(['g1'])
    expect(data.enrollments).toEqual([])
    expect(data.attendance).toEqual([{ ...mark, id: 'd2', status: 'absent', updatedAt: '2026-11-02T11:00:00.000Z' }])
    expect(data.teachers).toEqual([])
    expect(dropped).toBe(6)
  })

  it('sozlamalar v11 maydonlari standart qiymat bilan to\'ldiriladi', () => {
    expect(sanitizeSettings({})).toMatchObject({ attendanceEditDays: 3, prorateFirstMonth: false, paymentDueDay: 10 })
    expect(sanitizeSettings({ attendanceEditDays: 7, paymentDueDay: 31 })).toMatchObject({ attendanceEditDays: 7, paymentDueDay: 10 })
  })
})
