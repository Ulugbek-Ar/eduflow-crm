import { describe, expect, it } from 'vitest'
import { dateStamp, escapeCsvCell, toCsv, toSpreadsheetXml } from './export.service'
import type { ExportColumn } from './export.service'

interface Row {
  name: string
  amount: number
}

const columns: ExportColumn<Row>[] = [
  { header: 'Ism', value: (r) => r.name },
  { header: 'Summa', value: (r) => r.amount, type: 'number' },
]

describe('escapeCsvCell', () => {
  it('ajratgich, qo\'shtirnoq va yangi qatorni qo\'shtirnoqqa oladi', () => {
    expect(escapeCsvCell('a;b')).toBe('"a;b"')
    expect(escapeCsvCell('a,b', ',')).toBe('"a,b"')
    expect(escapeCsvCell('a,b', ';')).toBe('a,b')
    expect(escapeCsvCell('U "Apex" dedi')).toBe('"U ""Apex"" dedi"')
    expect(escapeCsvCell('1-qator\n2-qator')).toBe('"1-qator\n2-qator"')
    expect(escapeCsvCell('a\r\nb')).toBe('"a\r\nb"')
  })

  it('o\'zbek harflarini o\'zgartirmaydi', () => {
    expect(escapeCsvCell('G\'ulomov O\'tkir — Shoʻrchi, Ғўзал')).toBe('G\'ulomov O\'tkir — Shoʻrchi, Ғўзал')
  })

  it('formula bilan boshlangan matnni zararsizlantiradi (CSV injection)', () => {
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe('\'=SUM(A1:A2)')
    expect(escapeCsvCell('@cmd')).toBe('\'@cmd')
    expect(escapeCsvCell('+998 90 123 45 67')).toBe('\'+998 90 123 45 67')
  })

  it('raqamlar o\'zgarishsiz (manfiy summa formula emas)', () => {
    expect(escapeCsvCell(-500000)).toBe('-500000')
  })
})

describe('toCsv', () => {
  it('BOM, sarlavha va CRLF qatorlar', () => {
    const csv = toCsv([{ name: 'Aziza; Karimova', amount: 650000 }], columns)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).split('\r\n')).toEqual(['Ism;Summa', '"Aziza; Karimova";650000'])
  })

  it('vergul ajratgichi', () => {
    expect(toCsv([{ name: 'A', amount: 1 }], columns, ',').slice(1)).toBe('Ism,Summa\r\nA,1')
  })

  it('bo\'sh ro\'yxatda faqat sarlavha', () => {
    expect(toCsv([], columns).slice(1)).toBe('Ism;Summa')
  })
})

describe('toSpreadsheetXml', () => {
  const xml = toSpreadsheetXml([{ name: '<b>Tom & Jerry</b>\u0007', amount: 650000 }], columns, 'Hisobot/2026: [oktabr]')

  it('summa raqam turida, sarlavha qalin', () => {
    expect(xml).toContain('<Data ss:Type="Number">650000</Data>')
    expect(xml).toContain('<Font ss:Bold="1"/>')
    expect(xml).toContain('<Cell ss:StyleID="header"><Data ss:Type="String">Ism</Data></Cell>')
  })

  it('XML belgilarini ekranlaydi va boshqaruv belgilarini olib tashlaydi', () => {
    expect(xml).toContain('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;</Data>')
    expect(xml).not.toContain('\u0007')
  })

  it('varaq nomidagi taqiqlangan belgilarni almashtiradi', () => {
    expect(xml).toContain('<Worksheet ss:Name="Hisobot 2026   oktabr ">')
  })
})

describe('dateStamp', () => {
  it('mahalliy sana bo\'yicha', () => {
    expect(dateStamp(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05')
  })
})
