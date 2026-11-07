import { describe, expect, it } from 'vitest'
import { decodeText, detectSeparator, parseCsv } from './csv'

describe('CSV parser', () => {
  it('ajratgichni aniqlaydi: ; , tab', () => {
    expect(detectSeparator('Ism;Telefon;Kurs\nAli;901234567;IELTS')).toBe(';')
    expect(detectSeparator('Name,Phone\n"Ali, Vali",901234567')).toBe(',')
    expect(detectSeparator('Имя\tТелефон\nАли\t901234567')).toBe('\t')
    // Matn ichidagi vergul hisobga olinmaydi (qo'shtirnoqda)
    expect(detectSeparator('Ism;Izoh\nAli;"kech, 18:00"\nVali;"ertalab, 9:00"')).toBe(';')
  })

  it('qo\'shtirnoq, "" va maydon ichidagi qator ko\'chishi; BOM va CRLF', () => {
    const text = '﻿Ism;Izoh\r\n"Aziza ""Ziyo"" Karimova";"1-qator\r\n2-qator"\r\n\r\nBobur;oddiy\r\n'
    expect(parseCsv(text)).toEqual([
      ['Ism', 'Izoh'],
      ['Aziza "Ziyo" Karimova', '1-qator\r\n2-qator'],
      ['Bobur', 'oddiy'],
    ])
  })

  it('CR qator ko\'chishi, bo\'sh qatorlar va oxirgi qator ko\'chishisiz', () => {
    expect(parseCsv('a,b\r1,2\r\r3,4', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
    expect(parseCsv(';;\nAli;;\n', ';')).toEqual([['Ali', '', '']])
  })

  it('UTF-8 bo\'lmagan fayl Windows-1251 deb o\'qiladi (rus Excel CSV)', () => {
    // "Имя;Телефон" — cp1251 baytlarida
    const bytes = new Uint8Array([0xc8, 0xec, 0xff, 0x3b, 0xd2, 0xe5, 0xeb, 0xe5, 0xf4, 0xee, 0xed])
    expect(decodeText(bytes)).toBe('Имя;Телефон')
    expect(decodeText(new TextEncoder().encode('Oʻzbekcha'))).toBe('Oʻzbekcha')
  })
})
