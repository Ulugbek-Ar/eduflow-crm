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
  // null — bog'lanmagan to'lov (bitta telefonda bir nechta o'quvchi, qaysi biriniki aniq emas)
  customerId: string | null
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
  // N-2: Payme test kaliti bilan (sandbox) — kassa, qarz va hisobotlarga kirmaydi
  isTest?: boolean
}

export interface PaymentCustomer {
  id: string
  name: string
}

// Hisob: o'quvchi id'si (havoladagi ac.student / Click transaction_param) va/yoki telefon
export interface PaymentRef {
  customerId?: string
  phone?: string
}

// 'ambiguous' — telefon bir nechta o'quvchiga mos, qarzi bor yagona o'quvchi yo'q: to'lov qabul qilinadi, bog'lanmagan yoziladi
export type FoundCustomer = PaymentCustomer | 'ambiguous' | null

export interface PaymentStore {
  findCustomer: (ref: PaymentRef) => Promise<FoundCustomer>
  get: (providerId: string) => Promise<PaymentTx | null>
  // Takror chaqirilsa mavjudi qaytadi
  create: (input: { providerId: string; customerId: string | null; amount: number; createTime: number; account: Record<string, string>; isTest?: boolean }) => Promise<PaymentTx>
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

// O'quvchi id'si: harf bilan boshlanadi (c12, cmwm4lis…); faqat raqamlar — telefon
const CUSTOMER_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

// Hisob maydonidan: id va/yoki telefon (Click'da bitta maydon — ikkalasidan biri)
export function accountRef(student: unknown, phone: unknown): PaymentRef | null {
  const ref: PaymentRef = {}
  if (typeof student === 'string' && CUSTOMER_ID.test(student.trim())) ref.customerId = student.trim()
  const digits = accountPhone(phone)
  if (digits) ref.phone = digits
  else if (!ref.customerId && typeof phone === 'string' && CUSTOMER_ID.test(phone.trim())) ref.customerId = phone.trim()
  return ref.customerId || ref.phone ? ref : null
}
