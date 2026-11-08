// Click SHOP API (Prepare / Complete) — sof protokol mantig'i. Edge Function (supabase/functions/click) formani
// o'qiydi, kalit va omborni beradi. Hujjat: https://docs.click.uz/click-api-request/
//
// merchant_trans_id — o'quvchi (ota-ona) telefoni (to'lov havolasida transaction_param). Summa — so'mda ("650000.00").
// Imzo: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + [merchant_prepare_id] + amount + action + sign_time)
import { md5, safeEqual } from './hash.ts'
import { accountPhone, isRecord, MAX_PAYMENT_SOM, MIN_PAYMENT_SOM } from './payments.ts'
import type { PaymentStore } from './payments.ts'

export interface ClickConfig {
  serviceId: string
  secretKey: string
}

export function isClickConfig(value: unknown): value is ClickConfig {
  return isRecord(value) && typeof value.serviceId === 'string' && typeof value.secretKey === 'string' && value.secretKey.length > 0
}

export interface ClickResponse {
  click_trans_id: string
  merchant_trans_id: string
  merchant_prepare_id?: number
  merchant_confirm_id?: number
  error: number
  error_note: string
}

export interface ClickContext {
  config: ClickConfig | null
  store: PaymentStore
  now: number
}

const NOTES: Record<number, string> = {
  0: 'Success',
  [-1]: 'SIGN CHECK FAILED!',
  [-2]: 'Incorrect parameter amount',
  [-3]: 'Action not found',
  [-4]: 'Already paid',
  [-5]: 'User does not exist',
  [-6]: 'Transaction does not exist',
  [-7]: 'Failed to update user',
  [-8]: 'Error in request from click',
  [-9]: 'Transaction cancelled',
}

// Imzo (testlar va tekshiruv uchun bir xil)
export function clickSign(p: Record<string, string>, secretKey: string): string {
  const prepareId = p.action === '1' ? (p.merchant_prepare_id ?? '') : ''
  return md5(`${p.click_trans_id ?? ''}${p.service_id ?? ''}${secretKey}${p.merchant_trans_id ?? ''}${prepareId}${p.amount ?? ''}${p.action ?? ''}${p.sign_time ?? ''}`)
}

const REQUIRED = ['click_trans_id', 'service_id', 'merchant_trans_id', 'amount', 'action', 'sign_time', 'sign_string'] as const

export async function handleClick(p: Record<string, string>, ctx: ClickContext): Promise<ClickResponse> {
  const reply = (error: number, extra: Partial<ClickResponse> = {}): ClickResponse => ({
    click_trans_id: p.click_trans_id ?? '',
    merchant_trans_id: p.merchant_trans_id ?? '',
    ...extra,
    error,
    error_note: NOTES[error] ?? 'Error',
  })
  if (REQUIRED.some((key) => !p[key]) || !ctx.config) return reply(-8)
  if (p.action !== '0' && p.action !== '1') return reply(-3)
  if (p.action === '1' && !p.merchant_prepare_id) return reply(-8)
  if (!safeEqual(clickSign(p, ctx.config.secretKey), p.sign_string.toLowerCase())) return reply(-1)
  if (p.service_id !== ctx.config.serviceId) return reply(-8)

  const som = Number(p.amount)
  if (!Number.isFinite(som) || som < MIN_PAYMENT_SOM || som > MAX_PAYMENT_SOM) return reply(-2)
  const amount = Math.round(som * 100)

  try {
    if (p.action === '0') {
      const phone = accountPhone(p.merchant_trans_id)
      const customer = phone ? await ctx.store.findCustomer(phone) : null
      if (!phone || !customer) return reply(-5)
      const existing = await ctx.store.get(p.click_trans_id)
      if (existing?.state === 2) return reply(-4, { merchant_prepare_id: existing.num })
      if (existing && existing.state < 0) return reply(-9)
      const tx = existing ?? (await ctx.store.create({ providerId: p.click_trans_id, customerId: customer.id, amount, createTime: ctx.now, account: { phone } }))
      return reply(0, { merchant_prepare_id: tx.num })
    }

    // Complete
    const tx = await ctx.store.get(p.click_trans_id)
    if (!tx || String(tx.num) !== p.merchant_prepare_id) return reply(-6)
    if (tx.state === 2) return reply(-4, { merchant_confirm_id: tx.num })
    if (tx.state < 0) return reply(-9)
    // Click to'lovni amalga oshira olmadi (error < 0) — tayyorlangan tranzaksiya bekor qilinadi
    if (Number(p.error ?? '0') < 0) {
      await ctx.store.cancel(tx.providerId, null, ctx.now)
      return reply(-9)
    }
    if (amount !== tx.amount) return reply(-2)
    const done = await ctx.store.perform(tx.providerId, ctx.now)
    return reply(0, { merchant_confirm_id: done.num })
  } catch {
    return reply(-7)
  }
}
