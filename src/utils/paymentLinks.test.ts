import { describe, expect, it } from 'vitest'
import { clickPayUrl, onlinePaymentsEnabled, paymeCheckoutUrl, paymentLink } from './paymentLinks'

const off = { paymeMerchantId: '', clickServiceId: '', clickMerchantId: '' }
const PAYME = '5e730e8e0b852a417aa49ceb'

describe('onlayn to\'lov havolalari', () => {
  it('Payme: base64 parametrlari — merchant, telefon (9 xona), summa tiyinda, til', () => {
    const url = paymeCheckoutUrl(PAYME, '+998 90 123 45 67', 650_000, 'ru')
    expect(url.startsWith('https://checkout.paycom.uz/')).toBe(true)
    expect(atob(url.slice('https://checkout.paycom.uz/'.length))).toBe(`m=${PAYME};ac.phone=901234567;a=65000000;l=ru`)
  })

  it('Click: service_id, merchant_id, summa so\'mda, transaction_param — telefon', () => {
    const url = new URL(clickPayUrl('12345', '678', '+998 90 123 45 67', 650_000))
    expect(url.origin + url.pathname).toBe('https://my.click.uz/services/pay')
    expect(Object.fromEntries(url.searchParams)).toEqual({ service_id: '12345', merchant_id: '678', amount: '650000', transaction_param: '901234567' })
  })

  it('tanlov: Payme ustun, keyin Click; ulanmagan, summa 0 yoki telefon noto\'g\'ri — null', () => {
    expect(onlinePaymentsEnabled(off)).toBe(false)
    expect(onlinePaymentsEnabled({ ...off, clickServiceId: '1' })).toBe(false)
    expect(onlinePaymentsEnabled({ ...off, clickServiceId: '1', clickMerchantId: '2' })).toBe(true)
    expect(paymentLink(off, '+998 90 123 45 67', 650_000)).toBeNull()
    expect(paymentLink({ paymeMerchantId: PAYME, clickServiceId: '1', clickMerchantId: '2' }, '+998 90 123 45 67', 650_000)).toMatch(/^https:\/\/checkout\.paycom\.uz\//)
    expect(paymentLink({ ...off, clickServiceId: '1', clickMerchantId: '2' }, '+998 90 123 45 67', 650_000)).toMatch(/^https:\/\/my\.click\.uz\//)
    expect(paymentLink({ ...off, paymeMerchantId: PAYME }, '+998 90 123 45 67', 0)).toBeNull()
    expect(paymentLink({ ...off, paymeMerchantId: PAYME }, '12345', 650_000)).toBeNull()
  })
})
