import { describe, expect, it } from 'vitest'
import { daysAgo, fillTemplate, monthName, smsSegments, smsUrl, telegramShare } from './reminders'

describe('to\'lov eslatmalari', () => {
  it('shablon o\'zgaruvchilari almashtiriladi, noma\'lumi qoladi', () => {
    expect(fillTemplate('Salom, {ism}! {kurs} ({guruh}) {oy} — {summa}. {markaz}: {telefon}. {boshqa}', {
      ism: 'Aziza',
      kurs: 'IELTS',
      guruh: 'IELTS — kechki',
      oy: 'noyabr',
      summa: '650 000 so\'m',
      markaz: 'EduFlow',
      telefon: '+998 71 200 00 00',
    })).toBe('Salom, Aziza! IELTS (IELTS — kechki) noyabr — 650 000 so\'m. EduFlow: +998 71 200 00 00. {boshqa}')
  })

  it('oy nomi o\'zbek va rus tilida', () => {
    expect(monthName(new Date(2026, 10, 7), 'uz')).toBe('noyabr')
    expect(monthName(new Date(2026, 10, 7), 'ru')).toBe('ноябрь')
  })

  it('SMS, Telegram havolalari va "N kun oldin"', () => {
    expect(smsUrl('+998 90 123 45 67', 'Salom dunyo')).toBe('sms:+998901234567?body=Salom%20dunyo')
    expect(telegramShare('Qarz: 650 000')).toContain('text=Qarz%3A%20650%20000')
    expect(daysAgo('2026-11-04T23:00:00', new Date('2026-11-07T08:00:00'))).toBe(3)
    expect(daysAgo('2026-11-07T01:00:00', new Date('2026-11-07T23:00:00'))).toBe(0)
  })
})

describe('SMS bo\'laklari (Eskiz narxi)', () => {
  it('lotin (GSM-7): 160 belgigacha 1 ta, keyin 153 dan; kirill yoki ʻ — 70 / 67', () => {
    expect(smsSegments('')).toBe(0)
    expect(smsSegments('a'.repeat(160))).toBe(1)
    expect(smsSegments('a'.repeat(161))).toBe(2)
    expect(smsSegments("To'lov — 650 000 so'm".replace('—', '-'))).toBe(1)
    expect(smsSegments('я'.repeat(70))).toBe(1)
    expect(smsSegments('я'.repeat(71))).toBe(2)
    expect(smsSegments('oʻquvchi ' + 'a'.repeat(70))).toBe(2)
  })
})
