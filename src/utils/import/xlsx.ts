// .xlsx o'qish (kutubxonasiz): zip markaziy katalogi -> fayllar, siqilgani `DecompressionStream('deflate-raw')` bilan
// ochiladi; workbook (varaqlar), sharedStrings, inlineStr, sonlar, mantiqiy qiymatlar va Excel seriya sanalari
// (uslubdagi sana formati bo'yicha, 1900 va 1904 tizimlari). XML — DOMParser'siz (Web Worker'da ham ishlaydi)

export interface XlsxSheet {
  name: string
  rows: string[][]
}

export class XlsxError extends Error {}

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
// Zip-bomba himoyasi: bitta ichki fayl ochilganda ko'pi bilan 64 MB
const MAX_ENTRY_BYTES = 64 * 1024 * 1024

interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  size: number
  offset: number
}

function readEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new XlsxError('zip')
  const count = view.getUint16(eocd + 10, true)
  let pointer = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  const entries = new Map<string, ZipEntry>()
  for (let n = 0; n < count; n++) {
    if (pointer + 46 > bytes.length || view.getUint32(pointer, true) !== CENTRAL) throw new XlsxError('zip')
    const method = view.getUint16(pointer + 10, true)
    const compressedSize = view.getUint32(pointer + 20, true)
    const size = view.getUint32(pointer + 24, true)
    const nameLength = view.getUint16(pointer + 28, true)
    const extraLength = view.getUint16(pointer + 30, true)
    const commentLength = view.getUint16(pointer + 32, true)
    const offset = view.getUint32(pointer + 42, true)
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength))
    entries.set(name.replace(/^\/+/, ''), { name, method, compressedSize, size, offset })
    pointer += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

// Ochilgan hajm oqim davomida sanaladi: zip'dagi e'lon qilingan hajm yolg'on bo'lishi mumkin ("zip-bomba" —
// 5 MB fayl gigabaytlarga ochilib, tabni qotirib qo'ymasin)
export async function inflateRaw(data: Uint8Array, limit = MAX_ENTRY_BYTES): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new XlsxError('unsupported')
  const body = new Response(data.slice()).body
  if (!body) throw new XlsxError('zip')
  const reader = body.pipeThrough(new DecompressionStream('deflate-raw')).getReader()
  const parts: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => undefined)
      throw new XlsxError('size')
    }
    parts.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  if (entry.size > MAX_ENTRY_BYTES) throw new XlsxError('size')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(entry.offset, true) !== LOCAL) throw new XlsxError('zip')
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true)
  const raw = bytes.subarray(start, start + entry.compressedSize)
  let data: Uint8Array
  if (entry.method === 0) data = raw
  else if (entry.method === 8) data = await inflateRaw(raw)
  else throw new XlsxError('unsupported')
  if (data.length > MAX_ENTRY_BYTES) throw new XlsxError('size')
  return new TextDecoder().decode(data)
}

// ===== XML yordamchilari =====

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' }

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

function attr(tag: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag)
  return match ? decodeXml(match[2] ?? match[3] ?? '') : undefined
}

// <t>…</t> matnlari (rPh — talaffuz yozuvi — tashlanadi)
function textRuns(xml: string): string {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  let result = ''
  for (const match of clean.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) result += decodeXml(match[1] ?? '')
  return result
}

function sharedStrings(xml: string): string[] {
  const list: string[] = []
  for (const match of xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) list.push(textRuns(match[1] ?? ''))
  return list
}

// Sana formatlari: o'rnatilgan 14–22, 27–36, 45–47, 50–58 va d/y belgisi bor maxsus formatlar
const BUILTIN_DATES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58])

export function isDateFormat(code: string): boolean {
  const plain = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[[^\]]*\]/g, '')
  return /[dy]/i.test(plain)
}

function dateStyles(xml: string | undefined): boolean[] {
  if (!xml) return []
  const custom = new Map<number, string>()
  for (const match of xml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(match[0], 'numFmtId'))
    const code = attr(match[0], 'formatCode')
    if (Number.isFinite(id) && code !== undefined) custom.set(id, code)
  }
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? ''
  const result: boolean[] = []
  for (const match of cellXfs.matchAll(/<xf\b[^>]*>/g)) {
    const id = Number(attr(match[0], 'numFmtId') ?? '0')
    const code = custom.get(id)
    result.push(code !== undefined ? isDateFormat(code) : BUILTIN_DATES.has(id))
  }
  return result
}

// Excel seriya sanasi -> 'YYYY-MM-DD' (1900 tizimidagi 29-fevral xatosi 1899-12-30 asosida hisobga olingan)
export function excelSerialToDate(serial: number, date1904 = false): string {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0)
  const ms = (days - 25_569) * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

// "B12" -> 1 (0 dan)
function columnIndex(ref: string): number {
  let index = 0
  for (const char of ref.toUpperCase()) {
    const code = char.charCodeAt(0)
    if (code < 65 || code > 90) break
    index = index * 26 + (code - 64)
  }
  return index - 1
}

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function sheetRows(xml: string, strings: readonly string[], dates: readonly boolean[], date1904: boolean, maxRows: number): Promise<string[][]> {
  const rows: string[][] = []
  const data = /<sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/.exec(xml)?.[1] ?? ''
  let processed = 0
  for (const rowMatch of data.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = []
    let next = 0
    for (const cellMatch of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = cellMatch[1]
      const body = cellMatch[2] ?? ''
      const ref = attr(tag, 'r')
      const index = ref ? columnIndex(ref) : next
      next = index + 1
      const type = attr(tag, 't') ?? 'n'
      const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1]
      let value = ''
      if (type === 's') value = strings[Number(raw)] ?? ''
      else if (type === 'inlineStr') value = textRuns(/<is\b[^>]*>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? '')
      else if (type === 'str') value = decodeXml(raw ?? '')
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE'
      else if (type === 'e') value = ''
      else if (raw !== undefined && raw.trim() !== '') {
        const number = Number(raw)
        const style = Number(attr(tag, 's') ?? '0')
        value = Number.isFinite(number) && dates[style] ? excelSerialToDate(number, date1904) : Number.isFinite(number) ? String(number) : decodeXml(raw)
      }
      while (row.length < index) row.push('')
      row[index] = value
    }
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
    if (rows.length > maxRows) break
    // Katta varaqda interfeys qotmasin
    if (++processed % 500 === 0) await yieldToMain()
  }
  return rows
}

// Barcha varaqlar (ko'pi bilan maxRows + 1 qator — limitdan oshganini aniqlash uchun)
export async function readXlsx(bytes: Uint8Array, maxRows = 5001): Promise<XlsxSheet[]> {
  const entries = readEntries(bytes)
  const read = async (path: string): Promise<string | undefined> => {
    const entry = entries.get(path)
    return entry ? readEntry(bytes, entry) : undefined
  }
  const workbook = await read('xl/workbook.xml')
  if (!workbook) throw new XlsxError('workbook')
  const rels = (await read('xl/_rels/workbook.xml.rels')) ?? ''
  const targets = new Map<string, string>()
  for (const match of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(match[0], 'Id')
    const target = attr(match[0], 'Target')
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`)
  }
  const pr = /<workbookPr\b[^>]*>/.exec(workbook)?.[0] ?? ''
  const date1904 = ['1', 'true'].includes(attr(pr, 'date1904') ?? '')
  const strings = sharedStrings((await read('xl/sharedStrings.xml')) ?? '')
  const dates = dateStyles(await read('xl/styles.xml'))
  const sheets: XlsxSheet[] = []
  let position = 0
  for (const match of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    position += 1
    const name = attr(match[0], 'name') ?? `Sheet${position}`
    const rid = attr(match[0], 'r:id')
    const path = (rid && targets.get(rid)) ?? `xl/worksheets/sheet${position}.xml`
    const xml = await read(path)
    if (xml === undefined) continue
    sheets.push({ name, rows: await sheetRows(xml, strings, dates, date1904, maxRows) })
  }
  if (sheets.length === 0) throw new XlsxError('workbook')
  return sheets
}
