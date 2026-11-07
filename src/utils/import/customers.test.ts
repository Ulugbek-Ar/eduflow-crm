import { describe, expect, it } from 'vitest'
import type { Course } from '../../types/course.types'
import type { Customer } from '../../types/customer.types'
import { analyzeImport, buildPlan, detectMapping, guessMapping, looksLikeHeader, normalizePhone, parseImportDate, parseSource, parseStatus, skippedCsv } from './customers'
import type { ImportOptions } from './customers'

const course = (name: string): Course => ({ id: `k-${name}`, name, type: 'course', durationMonths: 6, monthlyPrice: 650_000, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' })
const existing: Customer = { id: 'c1', name: 'Aziza Karimova', phone: '+998 90 123 45 67', course: 'Ingliz tili (IELTS)', status: 'new', source: 'instagram', createdAt: '2026-10-01T10:00:00.000Z' }

const options = (patch: Partial<ImportOptions> = {}): ImportOptions => ({
  mapping: { name: 0, phone: 1, course: 2, status: 3, source: 4, date: 5, note: 6 },
  hasHeader: true,
  policy: 'skip',
  existing: [existing],
  courses: [course('Ingliz tili (IELTS)')],
  createCourses: new Set(),
  defaultSource: 'telegram',
  defaultStatus: 'new',
  today: '2026-11-07',
  ...patch,
})

describe('normallashtirish', () => {
  it('telefon: +998, 998…, 9 xonali, bo\'shliq, qavs va chiziqcha', () => {
    for (const raw of ['+998 90 123 45 67', '998901234567', '901234567', '(90) 123-45-67', '+998-90-123-45-67', ' 90 123 45 67 ']) expect(normalizePhone(raw), raw).toBe('+998 90 123 45 67')
    for (const raw of ['', '12345', '+7 912 345 67 89', '0901234567', '99890123456']) expect(normalizePhone(raw), raw).toBeNull()
  })

  it('holat va manba: o\'zbek, rus, ingliz sinonimlari', () => {
    expect(parseStatus('To\'lov qildi')).toBe('paid')
    expect(parseStatus('toʻlov qildi')).toBe('paid')
    expect(parseStatus('Оплатил')).toBe('paid')
    expect(parseStatus('lead')).toBe('new')
    expect(parseStatus('Думает')).toBe('thinking')
    expect(parseStatus('Отказ')).toBe('cancelled')
    expect(parseStatus('noma\'lum')).toBeNull()
    expect(parseSource('Instagram')).toBe('instagram')
    expect(parseSource('Телеграм')).toBe('telegram')
    expect(parseSource('Tavsiya')).toBe('referral')
    expect(parseSource('Сайт')).toBe('website')
    expect(parseSource('TV')).toBeNull()
  })

  it('sana: 31.12.2025, 2025-12-31, 31/12/25, ISO; noto\'g\'ri — null', () => {
    expect(parseImportDate('31.12.2025')).toBe('2025-12-31')
    expect(parseImportDate('2025-12-31')).toBe('2025-12-31')
    expect(parseImportDate('2025-12-31T09:30:00Z')).toBe('2025-12-31')
    expect(parseImportDate('31/12/25')).toBe('2025-12-31')
    expect(parseImportDate('1.2.2026')).toBe('2026-02-01')
    expect(parseImportDate('31.02.2026')).toBeNull()
    expect(parseImportDate('kecha')).toBeNull()
  })
})

describe('ustunlarni moslashtirish', () => {
  it('sarlavhalar: o\'zbek, rus va ingliz', () => {
    expect(detectMapping(['F.I.O', 'Telefon raqami', 'Kurs', 'Manba', 'Holat', 'Izoh', 'Qo\'shilgan sana'])).toEqual({ name: 0, phone: 1, course: 2, source: 3, status: 4, note: 5, date: 6 })
    expect(detectMapping(['№', 'ФИО', 'Номер телефона', 'Направление', 'Источник', 'Статус', 'Комментарий', 'Дата'])).toEqual({ name: 1, phone: 2, course: 3, source: 4, status: 5, note: 6, date: 7 })
    expect(detectMapping(['Full name', 'Phone', 'Course', 'Lead source', 'Stage', 'Notes', 'Created at'])).toEqual({ name: 0, phone: 1, course: 2, source: 3, status: 4, note: 5, date: 6 })
    // Telegram ustuni telefon emas
    expect(detectMapping(['Ism', 'Telegram', 'Tel'])).toEqual({ name: 0, phone: 2 })
  })

  it('sarlavha qatorini aniqlash va sarlavhasiz faylda taxmin', () => {
    expect(looksLikeHeader(['Ism', 'Telefon', 'Kurs'])).toBe(true)
    expect(looksLikeHeader(['Aziza', '901234567', 'IELTS'])).toBe(false)
    expect(guessMapping([['Aziza Karimova', '901234567', 'IELTS'], ['Bobur', '+998 93 111 22 33', '']])).toEqual({ phone: 1, name: 0 })
  })
})

describe('import tahlili', () => {
  const header = ['Ism', 'Telefon', 'Kurs', 'Holat', 'Manba', 'Sana', 'Izoh']
  const table = [
    header,
    ['Bobur Aliyev', '998931112233', 'ingliz tili (ielts)', 'Оплатил', 'Instagram', '01.10.2026', ''],
    ['Aziza K.', '90 123 45 67', 'Python', 'Yangi', 'TV', '2030-01-01', 'eski'],
    ['Dilnoza', '931112233', 'Python', '', '', '', ''],
    ['X', '911234567', '', '', '', '', ''],
    ['Kamola', '12345', '', '', '', '', ''],
    ['Jasur', '+998 94 555 66 77', 'python', 'думает', 'Telegram', 'kecha', ''],
  ]

  it('takrorlar (fayl ichida va bazada), xatolar, noma\'lum kurs — izohga; o\'tkazib yuborish', () => {
    const a = analyzeImport(table, options())
    expect(a.rows.map((r) => r.action)).toEqual(['create', 'skip', 'skip', 'error', 'error', 'create'])
    expect(a.rows[0]).toMatchObject({ line: 2, phone: '+998 93 111 22 33', course: 'Ingliz tili (IELTS)', status: 'paid', source: 'instagram', date: '2026-10-01' })
    expect(a.rows[1].reason).toBe('Bazada bor: Aziza Karimova')
    expect(a.rows[2].reason).toBe('Fayl ichida takror (2-qator)')
    expect(a.rows[3].reason).toBe('Ism yo\'q yoki juda qisqa')
    expect(a.rows[4].reason).toBe('Telefon noto\'g\'ri: 12345')
    // Noma'lum kurs (yaratilmaydi) — izohga; tanilmagan holat/sana — standart qiymat va ogohlantirish
    expect(a.rows[5]).toMatchObject({ course: '', note: 'Kurs: python', status: 'thinking', source: 'telegram' })
    expect(a.rows[5].warnings).toEqual(['Kurs topilmadi: python — izohga yozildi', 'Sana tanilmadi: kecha — bugungi sana'])
    expect([...a.unknownCourses.entries()]).toEqual([['Python', 3]])
    expect([a.created, a.updated, a.skipped, a.errors]).toEqual([2, 0, 4, 2])
  })

  it('yangilash rejimi va kurs yaratish; reja — paidAt, sana, faqat berilgan maydonlar', () => {
    const o = options({ policy: 'update', createCourses: new Set(['Python']) })
    const a = analyzeImport(table, o)
    expect(a.rows[1]).toMatchObject({ action: 'update', targetId: 'c1', course: 'Python', source: 'telegram' })
    expect(a.rows[1].warnings).toEqual(['Manba tanilmadi: TV', 'Sana kelajakda: 2030-01-01 — bugungi sana'])
    expect(a.rows[5]).toMatchObject({ action: 'create', course: 'Python', note: '' })
    const plan = buildPlan(a, o, 'mijozlar.csv', new Date('2026-11-07T08:00:00.000Z'))
    expect(plan.courses).toEqual(['Python'])
    expect(plan.create).toHaveLength(2)
    expect(plan.create[0]).toMatchObject({ name: 'Bobur Aliyev', status: 'paid', createdAt: new Date('2026-10-01T12:00:00').toISOString(), paidAt: new Date('2026-10-01T12:00:00').toISOString() })
    expect(plan.create[1]).not.toHaveProperty('paidAt')
    expect(plan.create[1].createdAt).toBe('2026-11-07T08:00:00.000Z')
    expect(plan.update).toEqual([{ id: 'c1', patch: { name: 'Aziza K.', course: 'Python', source: 'telegram', status: 'new', note: 'eski' } }])
    expect(plan.skipped).toBe(3)
  })

  it('o\'tkazilganlar CSV\'si: qator, ism, telefon, sabab', () => {
    const csv = skippedCsv(analyzeImport(table, options()))
    const lines = csv.replace('﻿', '').split('\r\n')
    expect(lines[0]).toBe('Qator;Ism;Telefon;Sabab')
    expect(lines).toHaveLength(5)
    // + bilan boshlangan qiymat Excel'da formula bo'lmasligi uchun ' bilan (eksportdagi kabi)
    expect(lines[1]).toBe('3;Aziza K.;\'+998 90 123 45 67;Bazada bor: Aziza Karimova')
    expect(lines[4]).toBe('6;Kamola;12345;Telefon noto\'g\'ri: 12345')
  })
})
