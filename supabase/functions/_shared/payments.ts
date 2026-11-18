// Onlayn to'lov (Payme, Click) uchun umumiy turlar. Ombor (store) — Edge Function'da SQL funksiyalari
// (supabase/migrations/20261108000000_online_payments.sql), testlarda — xotiradagi o'xshashi.

export type PaymentProvider = 'payme' | 'click'

export interface PaymentTx {
  provider: PaymentProvider
  // Provayder id'si (Payme tranzaksiyasi, Click click_trans_id)
  providerId: string
  // Bizning id (Payme javobidagi "transaction") va raqamli id (Click merchant_prepare_id / merchant_confirm_id)
  id: string
  num: number
  customerId: string
  // Tiyinda
  amount: number
  // 1 — yaratildi/tayyorlandi, 2 — bajarildi, -1 — bekor, -2 — bajarilgach bekor
  state: 1 | 2 | -1 | -2
  // Unix ms
  createTime: number
  performTime: number | null
  cancelTime: number | null
  reason: number | null
  account: Record<string, string>
}

export interface PaymentCustomer {
  id: string
  name: string
}

export interface PaymentStore {
  findCustomer: (account: string) => Promise<PaymentCustomer | null>
  get: (providerId: string) => Promise<PaymentTx | null>
  // Takror chaqirilsa mavjudi qaytadi
  create: (input: { providerId: string; customerId: string; amount: number; createTime: number; account: Record<string, string> }) => Promise<PaymentTx>
  // Kirim yozadi (bir marta); holat 2 bo'lsa o'zgarishsiz qaytadi
  perform: (providerId: string, now: number) => Promise<PaymentTx>
  cancel: (providerId: string, reason: number | null, now: number) => Promise<PaymentTx>
  statement: (from: number, to: number) => Promise<PaymentTx[]>
}

// Bitta to'lov chegarasi (so'mda)
export const MIN_PAYMENT_SOM = 1_000
export const MAX_PAYMENT_SOM = 100_000_000

// Hisob raqami — o'quvchi (ota-ona) telefoni: 9 xonali mahalliy raqam yoki 998 bilan 12 xonali
export function accountPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) return digits.slice(3)
  if (digits.length === 9 && /^[1-9]/.test(digits)) return digits
  return null
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
