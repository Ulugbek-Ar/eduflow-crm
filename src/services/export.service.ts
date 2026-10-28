export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number
}

// Excel'da o'zbekcha harflar to'g'ri ochilishi uchun UTF-8 BOM
const BOM = '﻿'
// O'zbekiston/Rossiya lokalidagi Excel ";" ni ustun ajratuvchi sifatida kutadi
const DELIMITER = ';'

function escapeCell(value: string | number): string {
  const text = String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function exportToCsv<T>(filename: string, rows: readonly T[], columns: readonly CsvColumn<T>[]): void {
  const header = columns.map((column) => escapeCell(column.header)).join(DELIMITER)
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(DELIMITER))
  downloadFile(filename, BOM + [header, ...body].join('\r\n'), 'text/csv;charset=utf-8')
}

export function downloadJson(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

export function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
