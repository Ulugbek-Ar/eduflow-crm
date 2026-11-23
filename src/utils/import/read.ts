// Import fayli -> jadval(lar): CSV (UTF-8 yoki Windows-1251), .xlsx va EduFlow shabloni kabi XML-.xls (SpreadsheetML 2003)
import { tr } from '../../i18n'
import { decodeText, parseCsv } from './csv'
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from './customers'
import { decodeXml, readXlsx, XlsxError } from './xlsx'
import type { XlsxSheet } from './xlsx'

export class ImportFileError extends Error {}

export const IMPORT_ACCEPT = '.csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

// SpreadsheetML 2003 (<Workbook><Worksheet><Table><Row><Cell><Data>) — EduFlow'ning .xls shabloni va eksporti shu formatda
export function readSpreadsheetXml(xml: string): XlsxSheet[] {
  const sheets: XlsxSheet[] = []
  let position = 0
  for (const sheet of xml.matchAll(/<(?:ss:)?Worksheet\b([^>]*)>([\s\S]*?)<\/(?:ss:)?Worksheet>/g)) {
    position += 1
    const name = decodeXml(/(?:ss:)?Name="([^"]*)"/.exec(sheet[1])?.[1] ?? `Sheet${position}`)
    const rows: string[][] = []
    for (const rowMatch of sheet[2].matchAll(/<(?:ss:)?Row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:ss:)?Row>)/g)) {
      const row: string[] = []
      for (const cellMatch of (rowMatch[1] ?? '').matchAll(/<(?:ss:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Cell>)/g)) {
        const index = Number(/(?:ss:)?Index="(\d+)"/.exec(cellMatch[1])?.[1] ?? '0')
        if (index > 0) while (row.length < index - 1) row.push('')
        const data = /<(?:ss:)?Data\b[^>]*>([\s\S]*?)<\/(?:ss:)?Data>/.exec(cellMatch[2] ?? '')?.[1] ?? ''
        row.push(decodeXml(data.replace(/<[^>]+>/g, '')))
      }
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
    }
    sheets.push({ name, rows })
  }
  return sheets
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((b, i) => bytes[i] === b)

export async function readImportFile(file: File): Promise<XlsxSheet[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportFileError(tr('Fayl 5 MB dan katta. Uni bir nechta faylga bo\'ling.'))
  const bytes = new Uint8Array(await file.arrayBuffer())
  let sheets: XlsxSheet[]
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    try {
      sheets = await readXlsx(bytes, MAX_IMPORT_ROWS + 1)
    } catch (error) {
      if (error instanceof XlsxError && error.message === 'unsupported') throw new ImportFileError(tr('Brauzeringiz bu Excel faylini ocholmadi. Faylni CSV qilib saqlab, qayta yuklang.'))
      throw new ImportFileError(tr('Excel faylini o\'qib bo\'lmadi. Fayl .xlsx formatida ekanini tekshiring.'))
    }
  } else if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
    throw new ImportFileError(tr('Eski Excel (.xls, 97–2003) formati o\'qilmaydi. Excel\'da "Saqlash" → ".xlsx" yoki CSV tanlang.'))
  } else {
    const text = decodeText(bytes)
    sheets = /^\s*(?:﻿)?<\?xml[\s\S]{0,400}urn:schemas-microsoft-com:office:spreadsheet/.test(text.slice(0, 2000))
      ? readSpreadsheetXml(text)
      : [{ name: file.name, rows: parseCsv(text) }]
  }
  const withData = sheets.filter((s) => s.rows.length > 0)
  if (withData.length === 0) throw new ImportFileError(tr('Faylda ma\'lumot topilmadi.'))
  if (withData.every((s) => s.rows.length > MAX_IMPORT_ROWS + 1)) throw new ImportFileError(tr('Faylda {0} tadan ortiq qator bor. Uni bir nechta faylga bo\'ling.', { 0: MAX_IMPORT_ROWS }))
  return withData
}
