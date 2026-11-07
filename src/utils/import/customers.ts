// Mijozlarni import qilish: ustunlarni aniqlash (o'zbek / rus / ingliz sarlavhalari), qiymatlarni normallashtirish,
// fayl ichidagi va bazadagi takrorlar, natija rejasi (qo'shiladi / yangilanadi / o'tkaziladi) va xatolar CSV'si
import { tr } from '../../i18n'
import type { Course } from '../../types/course.types'
import type { Customer, CustomerSource, CustomerStatus } from '../../types/customer.types'
import { formatPhone, phoneDigits } from '../phone'

export const MAX_IMPORT_ROWS = 5000
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export type ImportField = 'name' | 'phone' | 'course' | 'source' | 'status' | 'note' | 'date'

export const IMPORT_FIELDS: readonly ImportField[] = ['name', 'phone', 'course', 'source', 'status', 'note', 'date']

export type ColumnMapping = Partial<Record<ImportField, number>>

export type DuplicatePolicy = 'skip' | 'update'

// Matnni solishtirish uchun: kichik harf, apostrof turlari bitta, tinish belgilarisiz, bitta bo'shliq
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ`‘’´]/g, '\'')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Sarlavha sinonimlari (normalizeKey ko'rinishida)
const HEADER_SYNONYMS: Record<ImportField, readonly string[]> = {
  name: ['ism', 'ismi', 'ism familiya', 'ismi familiyasi', 'familiya ism', 'familiya ismi', 'fio', 'f i o', 'mijoz', 'mijoz ismi', 'o\'quvchi', 'o\'quvchi ismi', 'talaba', 'имя', 'фио', 'ф и о', 'имя фамилия', 'фамилия имя', 'клиент', 'ученик', 'студент', 'name', 'full name', 'fullname', 'student', 'client', 'customer'],
  phone: ['telefon', 'telefon raqami', 'telefoni', 'tel', 'raqam', 'raqami', 'mobil', 'телефон', 'тел', 'номер', 'номер телефона', 'мобильный', 'phone', 'phone number', 'mobile', 'telephone', 'contact'],
  course: ['kurs', 'kursi', 'kurs nomi', 'yo\'nalish', 'fan', 'xizmat', 'kurs xizmat', 'курс', 'направление', 'предмет', 'услуга', 'course', 'program', 'subject', 'service'],
  source: ['manba', 'manbasi', 'qayerdan', 'kanal', 'reklama', 'источник', 'откуда', 'канал', 'source', 'channel', 'utm source', 'lead source'],
  status: ['holat', 'holati', 'bosqich', 'bosqichi', 'status', 'статус', 'этап', 'состояние', 'stage', 'state'],
  note: ['izoh', 'izohlar', 'sharh', 'eslatma', 'комментарий', 'примечание', 'заметка', 'note', 'notes', 'comment', 'comments'],
  date: ['sana', 'qo\'shilgan sana', 'qo\'shilgan', 'ro\'yxatdan o\'tgan', 'ro\'yxatga olingan', 'дата', 'дата добавления', 'дата регистрации', 'date', 'created', 'created at', 'registration date'],
}

// Aniq mos kelmasa — sarlavhadagi so'z shu o'zak bilan boshlanadi
const HEADER_ROOTS: Record<ImportField, readonly string[]> = {
  phone: ['telefon', 'телефон', 'phone'],
  date: ['sana', 'дата', 'date'],
  status: ['holat', 'bosqich', 'status', 'статус', 'этап'],
  source: ['manba', 'источник', 'source'],
  course: ['kurs', 'курс', 'course'],
  note: ['izoh', 'коммент', 'примеч', 'note', 'comment'],
  name: ['ism', 'fio', 'имя', 'фио', 'name'],
}

function headerField(header: string): ImportField | null {
  const key = normalizeKey(header)
  if (!key) return null
  for (const field of IMPORT_FIELDS) if (HEADER_SYNONYMS[field].includes(key)) return field
  const words = key.split(' ')
  for (const field of Object.keys(HEADER_ROOTS) as ImportField[]) {
    if (HEADER_ROOTS[field].some((root) => words.some((word) => word.startsWith(root)))) return field
  }
  return null
}

// Sarlavha qatori bo'yicha moslik (har bir maydon — birinchi mos ustun)
export function detectMapping(header: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  header.forEach((cell, index) => {
    const field = headerField(cell)
    if (field && mapping[field] === undefined) mapping[field] = index
  })
  return mapping
}

// Birinchi qator sarlavhami: kamida ikkita katakcha ma'lum sarlavha va hech biri telefon raqamiga o'xshamaydi
export function looksLikeHeader(row: readonly string[]): boolean {
  const known = row.filter((cell) => headerField(cell) !== null).length
  return known >= 2 && !row.some((cell) => normalizePhone(cell) !== null)
}

// Sarlavhasiz fayl: telefon — qiymatlarining ko'pi telefon bo'lgan ustun, ism — undan oldingi (yoki birinchi) matnli ustun
export function guessMapping(rows: readonly string[][]): ColumnMapping {
  const sample = rows.slice(0, 20)
  const width = Math.max(0, ...sample.map((r) => r.length))
  let phone = -1
  for (let col = 0; col < width && phone < 0; col++) {
    const filled = sample.filter((r) => (r[col] ?? '').trim() !== '')
    if (filled.length > 0 && filled.filter((r) => normalizePhone(r[col] ?? '') !== null).length / filled.length >= 0.6) phone = col
  }
  const mapping: ColumnMapping = {}
  if (phone >= 0) mapping.phone = phone
  for (let col = 0; col < width; col++) {
    if (col === phone) continue
    if (sample.some((r) => /\p{L}{2,}/u.test(r[col] ?? ''))) {
      mapping.name = col
      break
    }
  }
  return mapping
}

// Telefon: +998 90 123 45 67, 998901234567, 901234567, (90) 123-45-67 ... -> "+998 90 123 45 67"; bo'lmasa null
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  let local: string | null = null
  if (digits.length === 12 && digits.startsWith('998')) local = digits.slice(3)
  else if (digits.length === 9) local = digits
  if (!local || !/^[1-9]/.test(local)) return null
  return formatPhone(local)
}

const STATUS_SYNONYMS: Record<CustomerStatus, readonly string[]> = {
  new: ['new', 'yangi', 'yangi lid', 'lid', 'lead', 'новый', 'новая', 'лид', 'новый лид'],
  contacted: ['contacted', 'bog\'lanildi', 'bog\'lanilgan', 'aloqa qilindi', 'связались', 'контакт', 'called'],
  thinking: ['thinking', 'o\'ylayapti', 'o\'ylab ko\'rmoqda', 'o\'ylamoqda', 'думает', 'considering'],
  paid: ['paid', 'to\'lov qildi', 'to\'ladi', 'to\'langan', 'o\'quvchi', 'o\'qiyapti', 'faol', 'оплатил', 'оплатила', 'оплачено', 'ученик', 'студент', 'активный', 'student', 'active'],
  cancelled: ['cancelled', 'canceled', 'bekor qilindi', 'bekor', 'rad etdi', 'ketdi', 'отказ', 'отменен', 'отказался', 'lost', 'refused'],
}

const SOURCE_SYNONYMS: Record<CustomerSource, readonly string[]> = {
  telegram: ['telegram', 'tg', 'телеграм', 'телеграмм'],
  instagram: ['instagram', 'insta', 'ig', 'инстаграм', 'инста'],
  website: ['website', 'sayt', 'veb sayt', 'web', 'site', 'сайт', 'google', 'internet', 'интернет'],
  referral: ['referral', 'tavsiya', 'tanish', 'tanishlar', 'do\'st', 'tavsiya orqali', 'рекомендация', 'знакомые', 'друг', 'сарафан', 'friend', 'recommendation'],
}

function fromSynonyms<T extends string>(raw: string, table: Record<T, readonly string[]>): T | null {
  const key = normalizeKey(raw)
  if (!key) return null
  for (const value of Object.keys(table) as T[]) if (table[value].includes(key)) return value
  return null
}

export const parseStatus = (raw: string): CustomerStatus | null => fromSynonyms(raw, STATUS_SYNONYMS)
export const parseSource = (raw: string): CustomerSource | null => fromSynonyms(raw, SOURCE_SYNONYMS)

const pad = (n: number) => String(n).padStart(2, '0')

function validDay(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d)
  if (y < 1990 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

// Sana: 'YYYY-MM-DD' (yoki ISO), 'DD.MM.YYYY', 'DD/MM/YYYY', 'DD-MM-YYYY', 'DD.MM.YY' -> 'YYYY-MM-DD'; bo'lmasa null
export function parseImportDate(raw: string): string | null {
  const value = raw.trim()
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(value)
  if (match) return validDay(Number(match[1]), Number(match[2]), Number(match[3]))
  match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s.*)?$/.exec(value)
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])
    return validDay(year, Number(match[2]), Number(match[1]))
  }
  return null
}

const courseKey = (name: string) => normalizeKey(name)

export interface ImportOptions {
  mapping: ColumnMapping
  hasHeader: boolean
  policy: DuplicatePolicy
  existing: readonly Customer[]
  courses: readonly Course[]
  // Yaratiladigan noma'lum kurslar (fayldagi yozilishi bo'yicha)
  createCourses: ReadonlySet<string>
  defaultSource: CustomerSource
  defaultStatus: CustomerStatus
  // 'YYYY-MM-DD' — kelajakdagi sana o'rniga bugun yoziladi
  today: string
}

export type RowAction = 'create' | 'update' | 'skip' | 'error'

export interface ImportRow {
  // Fayldagi qator raqami (1 dan, sarlavha bilan)
  line: number
  name: string
  phone: string
  course: string
  source: CustomerSource
  status: CustomerStatus
  note: string
  // 'YYYY-MM-DD'
  date?: string
  action: RowAction
  // Yangilanadigan mijoz
  targetId?: string
  // Xato yoki o'tkazib yuborilish sababi
  reason?: string
  warnings: string[]
}

export interface ImportAnalysis {
  rows: ImportRow[]
  created: number
  updated: number
  skipped: number
  errors: number
  // Bazada yo'q kurslar: fayldagi yozilishi -> qatorlar soni
  unknownCourses: Map<string, number>
}

export function analyzeImport(table: readonly string[][], o: ImportOptions): ImportAnalysis {
  const body = o.hasHeader ? table.slice(1) : table
  const offset = o.hasHeader ? 2 : 1
  const cell = (row: readonly string[], field: ImportField) => {
    const index = o.mapping[field]
    return index === undefined ? '' : (row[index] ?? '').replace(/\s+/g, ' ').trim()
  }
  const byPhone = new Map(o.existing.map((c) => [phoneDigits(c.phone), c]))
  const courseNames = new Map(o.courses.map((c) => [courseKey(c.name), c.name]))
  const seen = new Map<string, number>()
  const unknownCourses = new Map<string, number>()
  const rows: ImportRow[] = body.map((raw, i) => {
    const line = i + offset
    const warnings: string[] = []
    const name = cell(raw, 'name').slice(0, 100)
    const rawPhone = cell(raw, 'phone')
    const phone = normalizePhone(rawPhone)
    let note = cell(raw, 'note').slice(0, 500)

    // Kurs: mavjud kurs (katta-kichik harf farqisiz), yaratiladigan yoki topilmagan (izohga yoziladi)
    let course = ''
    const rawCourse = cell(raw, 'course')
    if (rawCourse) {
      const known = courseNames.get(courseKey(rawCourse))
      if (known) course = known
      else {
        const label = [...unknownCourses.keys()].find((k) => courseKey(k) === courseKey(rawCourse)) ?? rawCourse
        unknownCourses.set(label, (unknownCourses.get(label) ?? 0) + 1)
        if ([...o.createCourses].some((k) => courseKey(k) === courseKey(rawCourse))) course = label
        else {
          warnings.push(tr('Kurs topilmadi: {0} — izohga yozildi', { 0: rawCourse }))
          note = [note, tr('Kurs: {0}', { 0: rawCourse })].filter(Boolean).join(' · ')
        }
      }
    }

    const rawSource = cell(raw, 'source')
    const source = rawSource ? parseSource(rawSource) : null
    if (rawSource && !source) warnings.push(tr('Manba tanilmadi: {0}', { 0: rawSource }))
    const rawStatus = cell(raw, 'status')
    const status = rawStatus ? parseStatus(rawStatus) : null
    if (rawStatus && !status) warnings.push(tr('Bosqich tanilmadi: {0}', { 0: rawStatus }))
    const rawDate = cell(raw, 'date')
    let date = rawDate ? parseImportDate(rawDate) : null
    if (rawDate && !date) warnings.push(tr('Sana tanilmadi: {0} — bugungi sana', { 0: rawDate }))
    if (date && date > o.today) {
      warnings.push(tr('Sana kelajakda: {0} — bugungi sana', { 0: rawDate }))
      date = null
    }

    const row: ImportRow = {
      line,
      name,
      phone: phone ?? rawPhone,
      course,
      source: source ?? o.defaultSource,
      status: status ?? o.defaultStatus,
      note,
      date: date ?? undefined,
      action: 'create',
      warnings,
    }
    if (name.length < 2) return { ...row, action: 'error', reason: tr('Ism yo\'q yoki juda qisqa') }
    if (!phone) return { ...row, action: 'error', reason: rawPhone ? tr('Telefon noto\'g\'ri: {0}', { 0: rawPhone }) : tr('Telefon yo\'q') }
    const digits = phoneDigits(phone)
    const first = seen.get(digits)
    if (first !== undefined) return { ...row, action: 'skip', reason: tr('Fayl ichida takror ({0}-qator)', { 0: first }) }
    seen.set(digits, line)
    const existing = byPhone.get(digits)
    if (existing) {
      return o.policy === 'update'
        ? { ...row, action: 'update', targetId: existing.id, reason: tr('Bazada bor: {0} — yangilanadi', { 0: existing.name }) }
        : { ...row, action: 'skip', targetId: existing.id, reason: tr('Bazada bor: {0}', { 0: existing.name }) }
    }
    return row
  })
  return {
    rows,
    created: rows.filter((r) => r.action === 'create').length,
    updated: rows.filter((r) => r.action === 'update').length,
    skipped: rows.filter((r) => r.action === 'skip' || r.action === 'error').length,
    errors: rows.filter((r) => r.action === 'error').length,
    unknownCourses,
  }
}

// Bazaga yoziladigan reja (kontekst amali shu bo'yicha ishlaydi)
export interface ImportPlan {
  fileName: string
  create: Array<Omit<Customer, 'id'>>
  update: Array<{ id: string; patch: Partial<Omit<Customer, 'id' | 'createdAt'>> }>
  // Yaratiladigan kurslar nomi
  courses: string[]
  skipped: number
}

export function buildPlan(analysis: ImportAnalysis, o: Pick<ImportOptions, 'mapping' | 'createCourses'>, fileName: string, now = new Date()): ImportPlan {
  const nowIso = now.toISOString()
  const create: ImportPlan['create'] = []
  const update: ImportPlan['update'] = []
  for (const r of analysis.rows) {
    if (r.action === 'create') {
      const createdAt = r.date ? new Date(`${r.date}T12:00:00`).toISOString() : nowIso
      create.push({
        name: r.name,
        phone: r.phone,
        course: r.course,
        status: r.status,
        source: r.source,
        ...(r.note ? { note: r.note } : {}),
        createdAt,
        ...(r.status === 'paid' ? { paidAt: createdAt } : {}),
      })
    } else if (r.action === 'update' && r.targetId) {
      // Faqat faylda berilgan maydonlar yangilanadi (bo'sh katakcha — eski qiymat qoladi)
      const patch: ImportPlan['update'][number]['patch'] = { name: r.name }
      if (o.mapping.course !== undefined && r.course) patch.course = r.course
      if (o.mapping.source !== undefined) patch.source = r.source
      if (o.mapping.status !== undefined) patch.status = r.status
      if (r.note) patch.note = r.note
      update.push({ id: r.targetId, patch })
    }
  }
  const used = new Set(create.map((c) => c.course).concat(update.map((u) => u.patch.course ?? '')))
  return {
    fileName,
    create,
    update,
    courses: [...o.createCourses].filter((name) => used.has(name)),
    skipped: analysis.skipped,
  }
}

// Bajarilgan import: "Importni bekor qilish" uchun
export interface ImportReceipt {
  fileName: string
  createdIds: string[]
  // Yangilangan mijozlarning importdan oldingi holati
  previous: Customer[]
  courseIds: string[]
  added: number
  updated: number
  skipped: number
}

// Import qilinmagan qatorlar (takror va xatolar) — sababi bilan, Excel UZ/RU uchun ';' ajratgich va BOM
export function skippedCsv(analysis: ImportAnalysis): string {
  const escape = (value: string) => {
    const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = [tr('Qator'), tr('Ism'), tr('Telefon'), tr('Sabab')].join(';')
  const lines = analysis.rows
    .filter((r) => r.action === 'skip' || r.action === 'error')
    .map((r) => [String(r.line), r.name, r.phone, r.reason ?? ''].map(escape).join(';'))
  return `﻿${[header, ...lines].join('\r\n')}`
}

// Shablon: sarlavhalar va ikki namuna qator
export const TEMPLATE_HEADERS = [tr('Ism familiya'), tr('Telefon'), tr('Kurs'), tr('Manba'), tr('Holat'), tr('Izoh'), tr('Sana')]

export function templateRows(): string[][] {
  return [
    ['Aziza Karimova', '+998 90 123 45 67', 'Ingliz tili (IELTS)', 'Instagram', tr('Yangi'), tr('Kechki guruh'), '01.11.2026'],
    ['Bobur Aliyev', '998931234567', 'Matematika', tr('Tavsiya'), tr('To\'lov qildi'), '', '15.10.2026'],
  ]
}
