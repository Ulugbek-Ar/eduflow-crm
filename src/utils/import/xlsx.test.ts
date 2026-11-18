import { describe, expect, it } from 'vitest'
import { toSpreadsheetXml } from '../../services/export.service'
import { readSpreadsheetXml } from './read'
import { excelSerialToDate, inflateRaw, isDateFormat, readXlsx, XlsxError } from './xlsx'

// ===== Test uchun .xlsx yasash: zip (stored yoki deflate-raw) + Office Open XML =====

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const body = new Response(data.slice()).body
  if (!body) throw new Error('stream')
  return new Uint8Array(await new Response(body.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
}

async function zip(files: Record<string, string>, compress: boolean): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name)
    const raw = encoder.encode(content)
    const data = compress ? await deflateRaw(raw) : raw
    const crc = crc32(raw)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(8, compress ? 8 : 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(10, compress ? 8 : 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, centrals.length, true)
  ev.setUint16(10, centrals.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  const out = new Uint8Array(offset + centralSize + 22)
  let pos = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

function workbookFiles(date1904 = false): Record<string, string> {
  return {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook ${NS}>${date1904 ? '<workbookPr date1904="1"/>' : '<workbookPr/>'}<sheets><sheet name="Mijozlar" sheetId="1" r:id="rId1"/><sheet name="Bo&apos;sh &amp; boshqa" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="/xl/worksheets/other.xml"/></Relationships>',
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8"?><styleSheet ${NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/></numFmts><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="3"/></cellXfs></styleSheet>`,
    'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8"?><sst ${NS} count="4" uniqueCount="4"><si><t>Ism familiya</t></si><si><t>Telefon</t></si><si><r><t>Aziza </t></r><r><rPr><b/></rPr><t xml:space="preserve">Karimova</t></r><rPh><t>x</t></rPh></si><si><t>Ingliz &amp; IELTS &lt;A&gt;</t></si></sst>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet ${NS}><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Kurs</t></is></c><c r="D1" t="inlineStr"><is><t>Sana</t></is></c><c r="E1" t="inlineStr"><is><t>Sana 2</t></is></c><c r="F1" t="inlineStr"><is><t>Faol</t></is></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>998901234567</v></c><c r="C2" t="s"><v>3</v></c><c r="D2" s="1"><v>46333</v></c><c r="E2" s="2"><v>46333.75</v></c><c r="F2" t="b"><v>1</v></c></row>
      <row r="3"></row>
      <row r="4"><c r="A4" t="str"><f>CONCAT("Bo","bur")</f><v>Bobur</v></c><c r="C4" s="3"><v>650000</v></c><c r="F4" t="e"><v>#N/A</v></c></row>
    </sheetData></worksheet>`,
    'xl/worksheets/other.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet ${NS}><sheetData><row r="1"><c r="B1" t="inlineStr"><is><t>Vali</t></is></c></row></sheetData></worksheet>`,
  }
}

describe('XLSX parser (kutubxonasiz)', () => {
  for (const compress of [false, true]) {
    it(`varaqlar, sharedStrings (rich text), inlineStr, son, sana, mantiqiy, bo'sh katakchalar — ${compress ? 'deflate' : 'stored'}`, async () => {
      const sheets = await readXlsx(await zip(workbookFiles(), compress))
      expect(sheets.map((s) => s.name)).toEqual(['Mijozlar', 'Bo\'sh & boshqa'])
      expect(sheets[0].rows).toEqual([
        ['Ism familiya', 'Telefon', 'Kurs', 'Sana', 'Sana 2', 'Faol'],
        ['Aziza Karimova', '998901234567', 'Ingliz & IELTS <A>', '2026-11-07', '2026-11-07', 'TRUE'],
        ['Bobur', '', '650000', '', '', ''],
      ])
      // B1 dan boshlangan qator — A ustuni bo'sh
      expect(sheets[1].rows).toEqual([['', 'Vali']])
    })
  }

  it('1904 sana tizimi', async () => {
    const files = workbookFiles(true)
    const sheets = await readXlsx(await zip(files, false))
    // 46333 (1904) = 46333 + 1462 (1900)
    expect(sheets[0].rows[1][3]).toBe(excelSerialToDate(46333 + 1462))
  })

  it('seriya sana va formatlar', () => {
    expect(excelSerialToDate(1)).toBe('1899-12-31')
    expect(excelSerialToDate(61)).toBe('1900-03-01')
    expect(excelSerialToDate(45658)).toBe('2025-01-01')
    expect(isDateFormat('dd.mm.yyyy')).toBe(true)
    expect(isDateFormat('[$-419]d mmmm yyyy')).toBe(true)
    expect(isDateFormat('#,##0 "so\'m"')).toBe(false)
    expect(isDateFormat('0.00;[Red]-0.00')).toBe(false)
  })

  it('zip bo\'lmagan fayl — xato', async () => {
    await expect(readXlsx(new TextEncoder().encode('salom'))).rejects.toThrow()
  })
})

describe('XML-.xls (SpreadsheetML 2003) — EduFlow shabloni', () => {
  it('eksport qilingan shablon qayta o\'qiladi; ss:Index bilan o\'tkazilgan katakcha', () => {
    const xml = toSpreadsheetXml([['Aziza', '+998 90 123 45 67']], [{ header: 'Ism', value: (r: string[]) => r[0] }, { header: 'Telefon', value: (r: string[]) => r[1] }], 'Mijozlar')
    expect(readSpreadsheetXml(xml)).toEqual([{ name: 'Mijozlar', rows: [['Ism', 'Telefon'], ['Aziza', '+998 90 123 45 67']] }])
    const sparse = '<Workbook><Worksheet ss:Name="A &amp; B"><Table><Row><Cell><Data ss:Type="String">Ali</Data></Cell><Cell ss:Index="3"><Data ss:Type="Number">5</Data></Cell></Row></Table></Worksheet></Workbook>'
    expect(readSpreadsheetXml(sparse)).toEqual([{ name: 'A & B', rows: [['Ali', '', '5']] }])
  })
})

describe('zip-bomba himoyasi', () => {
  it('ochilgan hajm chegaradan oshsa — o\'qish to\'xtatiladi (e\'lon qilingan hajmga ishonilmaydi)', async () => {
    const big = new Uint8Array(2 * 1024 * 1024).fill(65)
    const packed = await deflateRaw(big)
    expect(packed.length).toBeLessThan(20_000)
    await expect(inflateRaw(packed, 1024 * 1024)).rejects.toBeInstanceOf(XlsxError)
    expect((await inflateRaw(packed, 4 * 1024 * 1024)).length).toBe(big.length)
  })
})
