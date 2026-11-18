import { describe, expect, it } from 'vitest'
import { isSettings, isTransaction, sanitizeSettings } from './guards'

describe('v1.2 maydonlari: onlayn to\'lov', () => {
  it('sozlamalar: Payme merchant (24 hex) va Click id\'lari (raqam), noto\'g\'risi — bo\'sh', () => {
    const ok = sanitizeSettings({ paymeMerchantId: '5E730E8E0B852A417AA49CEB', clickServiceId: '12345', clickMerchantId: '678' })
    expect(ok).toMatchObject({ paymeMerchantId: '5E730E8E0B852A417AA49CEB', clickServiceId: '12345', clickMerchantId: '678' })
    expect(isSettings(ok)).toBe(true)
    expect(sanitizeSettings({ paymeMerchantId: '<script>', clickServiceId: 'abc', clickMerchantId: 5 })).toMatchObject({ paymeMerchantId: '', clickServiceId: '', clickMerchantId: '' })
    // Eski (v1.1) sozlamalar — maydonlar standart qiymat bilan
    expect(sanitizeSettings({})).toMatchObject({ paymeMerchantId: '', clickServiceId: '', clickMerchantId: '' })
  })

  it('tranzaksiya: provider faqat payme/click, providerRef — matn', () => {
    const base = { id: 't1', type: 'income', amount: 650_000, method: 'card', category: 'course_fee', note: '', status: 'paid', date: '2026-11-08T09:00:00.000Z' }
    expect(isTransaction({ ...base, provider: 'payme', providerRef: 'pm-1' })).toBe(true)
    expect(isTransaction({ ...base, provider: 'click', providerRef: '9001' })).toBe(true)
    expect(isTransaction({ ...base, provider: 'paypal' })).toBe(false)
    expect(isTransaction({ ...base, provider: 'payme', providerRef: '' })).toBe(false)
  })
})

describe('v1.2 maydonlari: SMS va avtomatik eslatma', () => {
  it('jo\'natuvchi nomi, 3–30 kun va til; noto\'g\'risi — standart', () => {
    expect(sanitizeSettings({ smsSender: 'BilimPlus', autoReminders: true, autoRemindEveryDays: 5, autoRemindLang: 'ru' })).toMatchObject({ smsSender: 'BilimPlus', autoReminders: true, autoRemindEveryDays: 5, autoRemindLang: 'ru' })
    expect(sanitizeSettings({ smsSender: 'juda uzun nom bilan', autoReminders: 'ha', autoRemindEveryDays: 1, autoRemindLang: 'en' })).toMatchObject({ smsSender: '', autoReminders: false, autoRemindEveryDays: 7, autoRemindLang: 'uz' })
    expect(sanitizeSettings({ telegramBot: 'BilimPlus_bot', botAbsenceAlerts: false })).toMatchObject({ telegramBot: 'BilimPlus_bot', botAbsenceAlerts: false, botPaymentAlerts: true })
    expect(sanitizeSettings({ telegramBot: '@yomon bot', botPaymentAlerts: 'yo\'q' })).toMatchObject({ telegramBot: '', botAbsenceAlerts: true, botPaymentAlerts: true })
    expect(isSettings(sanitizeSettings({}))).toBe(true)
  })
})
