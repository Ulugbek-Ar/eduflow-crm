// Onlayn to'lov havolalari (eslatma matnida va ota-onaga): Payme checkout va Click. Hisob — o'quvchi telefoni (9 xona),
// Edge Function'lar shu raqam bo'yicha o'quvchini topadi va to'lovni avtomatik kirim qiladi
import type { Settings } from '../types/dashboard.types'
import { phoneDigits } from './phone'

export type PaymentLinkSettings = Pick<Settings, 'paymeMerchantId' | 'clickServiceId' | 'clickMerchantId'>

// https://checkout.paycom.uz/<base64("m=<merchant>;ac.phone=<telefon>;a=<tiyin>;l=<til>")>
export function paymeCheckoutUrl(merchantId: string, phone: string, amountSom: number, lang: 'uz' | 'ru' = 'uz'): string {
  const params = [`m=${merchantId}`, `ac.phone=${phoneDigits(phone)}`, `a=${Math.round(amountSom * 100)}`, `l=${lang}`]
  return `https://checkout.paycom.uz/${btoa(params.join(';'))}`
}

export function clickPayUrl(serviceId: string, merchantId: string, phone: string, amountSom: number): string {
  const query = new URLSearchParams({ service_id: serviceId, merchant_id: merchantId, amount: String(Math.round(amountSom)), transaction_param: phoneDigits(phone) })
  return `https://my.click.uz/services/pay?${query.toString()}`
}

export function onlinePaymentsEnabled(s: PaymentLinkSettings): boolean {
  return Boolean(s.paymeMerchantId || (s.clickServiceId && s.clickMerchantId))
}

// Payme ulangan bo'lsa — Payme, bo'lmasa Click; summa 0 yoki telefon noto'g'ri bo'lsa — null
export function paymentLink(s: PaymentLinkSettings, phone: string, amountSom: number, lang: 'uz' | 'ru' = 'uz'): string | null {
  if (amountSom <= 0 || phoneDigits(phone).length !== 9) return null
  if (s.paymeMerchantId) return paymeCheckoutUrl(s.paymeMerchantId, phone, amountSom, lang)
  if (s.clickServiceId && s.clickMerchantId) return clickPayUrl(s.clickServiceId, s.clickMerchantId, phone, amountSom)
  return null
}
