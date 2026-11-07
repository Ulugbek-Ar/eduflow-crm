// CSV o'qish (kutubxonasiz): ajratgich o'zi aniqlanadi (`,` `;` tab), qo'shtirnoqli maydonlar ("" — qo'shtirnoq),
// maydon ichidagi qator ko'chishi, BOM va CRLF / CR / LF

export type CsvSeparator = ',' | ';' | '\t'

const SEPARATORS: readonly CsvSeparator[] = [';', ',', '\t']

// Qo'shtirnoqdan tashqaridagi ajratgichlar soni — har bir qator uchun (birinchi 10 ta bo'sh bo'lmagan qator)
function separatorCounts(text: string, separator: CsvSeparator, maxLines = 10): number[] {
  const counts: number[] = []
  let count = 0
  let quoted = false
  let empty = true
  for (let i = 0; i < text.length && counts.length < maxLines; i++) {
    const char = text[i]
    if (char === '"') quoted = !quoted
    else if (!quoted && char === separator) count += 1
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (!empty) counts.push(count)
      count = 0
      empty = true
      continue
    }
    if (char !== '\n' && char !== '\r') empty = false
  }
  if (!empty && counts.length < maxLines) counts.push(count)
  return counts
}

// Eng ko'p qatorda bir xil (noldan katta) sonda uchragan ajratgich; teng bo'lsa — ko'proq ustun beradigani
export function detectSeparator(text: string): CsvSeparator {
  let best: CsvSeparator = ';'
  let bestScore = -1
  let bestColumns = 0
  for (const separator of SEPARATORS) {
    const counts = separatorCounts(text, separator)
    if (counts.length === 0) continue
    const first = counts[0]
    if (first === 0) continue
    const score = counts.filter((c) => c === first).length
    if (score > bestScore || (score === bestScore && first > bestColumns)) {
      best = separator
      bestScore = score
      bestColumns = first
    }
  }
  return best
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

// Matn -> qatorlar. To'liq bo'sh qatorlar tashlanadi; ustunlar soni qatorlar orasida har xil bo'lishi mumkin
export function parseCsv(input: string, separator: CsvSeparator = detectSeparator(stripBom(input))): string[][] {
  const text = stripBom(input)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  const pushRow = () => {
    row.push(field)
    field = ''
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
    row = []
  }
  while (i < text.length) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
      } else field += char
      i += 1
      continue
    }
    if (char === '"' && field.trim() === '') {
      // Qo'shtirnoq maydon boshida — qo'shtirnoqli maydon (oldidagi bo'shliqlar tashlanadi)
      field = ''
      quoted = true
    } else if (char === separator) {
      row.push(field)
      field = ''
    } else if (char === '\r' || char === '\n') {
      pushRow()
      if (char === '\r' && text[i + 1] === '\n') i += 1
    } else field += char
    i += 1
  }
  if (field !== '' || row.length > 0) pushRow()
  return rows
}

// Fayl baytlari -> matn: UTF-8 (BOM bilan yoki usiz); UTF-8 bo'lmasa — Windows-1251 (rus Excel'ining odatiy CSV kodirovkasi)
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1251').decode(bytes)
  }
}
