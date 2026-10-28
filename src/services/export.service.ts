import type { CsvDelimiter } from '../types/dashboard.types'

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number
  type?: 'string' | 'number'
  width?: number
}

// Excel'da o'zbekcha harflar to'g'ri ochilishi uchun UTF-8 BOM
const BOM = '﻿'

// =, +, -, @ bilan boshlangan matnni Excel formula deb bajarmasligi uchun (CSV injection)
const FORMULA_START = /^[=+\-@\t\r]/

export function escapeCsvCell(value: string | number, delimiter: CsvDelimiter = ';'): string {
  if (typeof value === 'number') return String(value)
  const text = FORMULA_START.test(value) ? `'${value}` : value
  const needsQuotes = text.includes(delimiter) || /["\n\r]/.test(text)
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[], delimiter: CsvDelimiter = ';'): string {
  const header = columns.map((column) => escapeCsvCell(column.header, delimiter)).join(delimiter)
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const value = column.value(row)
        return escapeCsvCell(column.type === 'number' ? value : String(value), delimiter)
      })
      .join(delimiter),
  )
  return BOM + [header, ...body].join('\r\n')
}

// XML 1.0'da ruxsat etilmagan boshqaruv belgilari olib tashlanadi
function isXmlChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d
}

function escapeXml(value: string): string {
  return Array.from(value)
    .filter(isXmlChar)
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cell(value: string | number, type: 'string' | 'number', style?: string): string {
  const styleAttr = style ? ` ss:StyleID="${style}"` : ''
  if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell${styleAttr}><Data ss:Type="Number">${value}</Data></Cell>`
  }
  return `<Cell${styleAttr}><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`
}

// Kutubxonasiz Excel: SpreadsheetML 2003 (.xls XML) — sarlavha qalin, summa raqam turida
export function toSpreadsheetXml<T>(rows: readonly T[], columns: readonly ExportColumn<T>[], sheetName: string): string {
  const safeName = escapeXml(sheetName.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31))
  const cols = columns.map((c) => `<Column ss:Width="${c.width ?? 120}"/>`).join('')
  const header = `<Row>${columns.map((c) => cell(c.header, 'string', 'header')).join('')}</Row>`
  const body = rows
    .map((row) => `<Row>${columns.map((c) => cell(c.value(row), c.type ?? 'string', c.type === 'number' ? 'number' : undefined)).join('')}</Row>`)
    .join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '<Styles>',
    '<Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="number"><NumberFormat ss:Format="#,##0"/></Style>',
    '</Styles>',
    `<Worksheet ss:Name="${safeName}">`,
    `<Table>${cols}`,
    header,
    body,
    '</Table>',
    '</Worksheet>',
    '</Workbook>',
  ].join('\n')
}

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Ba'zi brauzerlar yuklashni keyinroq boshlaydi, shuning uchun URL darhol bekor qilinmaydi
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ExportFormat = 'csv' | 'xls'

export function exportRows<T>(
  baseName: string,
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
  format: ExportFormat,
  options: { delimiter: CsvDelimiter; sheetName: string },
): string {
  const filename = `apex-${baseName}-${dateStamp()}.${format}`
  if (format === 'csv') downloadFile(filename, toCsv(rows, columns, options.delimiter), 'text/csv;charset=utf-8')
  else downloadFile(filename, toSpreadsheetXml(rows, columns, options.sheetName), 'application/vnd.ms-excel;charset=utf-8')
  return filename
}

export function downloadJson(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

// Mahalliy sana bo'yicha 'YYYY-MM-DD'
export function dateStamp(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
