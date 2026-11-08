// Payme Merchant API (JSON-RPC) — sof protokol mantig'i. Edge Function (supabase/functions/payme) faqat so'rovni
// o'qiydi, kalit va omborni beradi. Hujjat: https://developer.help.paycom.uz/ (Merchant API)
//
// Hisob (account) maydoni — "phone": o'quvchi (ota-ona) telefoni. Summa — tiyinda.
// Holatlar: 1 yaratildi, 2 bajarildi, -1 bekor, -2 bajarilgach bekor. Yaratilgandan 12 soat o'tsa — bajarib bo'lmaydi.
import { safeEqual } from './hash.ts'
import { accountPhone, isRecord, MAX_PAYMENT_SOM, MIN_PAYMENT_SOM } from './payments.ts'
import type { PaymentCustomer, PaymentStore, PaymentTx } from './payments.ts'

export const PAYME_TIMEOUT_MS = 43_200_000

export interface PaymeConfig {
  // Kassa kaliti (Paycom kabinetidan); test (sandbox) kaliti ixtiyoriy
  key: string
  testKey?: string
  // Fiskal chek uchun (ixtiyoriy): MXIK (IKPU) kodi, qadoq kodi, QQS %
  ikpu?: string
  packageCode?: string
  vatPercent?: number
}

export function isPaymeConfig(value: unknown): value is PaymeConfig {
  return isRecord(value) && typeof value.key === 'string' && value.key.length > 0
}

type RpcId = number | string | null

export interface PaymeError {
  code: number
  message: { uz: string; ru: string; en: string }
  data?: string
}

export type PaymeResponse = { id: RpcId; result: Record<string, unknown> } | { id: RpcId; error: PaymeError }

export interface PaymeContext {
  authorization: string | null
  config: PaymeConfig | null
  store: PaymentStore
  now: number
  // ChangePassword: yangi kassa kalitini saqlash
  changeKey?: (key: string) => Promise<void>
}

const MESSAGES = {
  auth: ['Ruxsat yo\'q', 'Недостаточно привилегий для выполнения метода', 'Insufficient privileges to perform this method'],
  parse: ['JSON o\'qib bo\'lmadi', 'Ошибка парсинга JSON', 'Parse error'],
  request: ['So\'rov noto\'g\'ri', 'Неверный RPC-запрос', 'Invalid RPC request'],
  method: ['Metod topilmadi', 'Запрашиваемый метод не найден', 'Method not found'],
  amount: ['Summa noto\'g\'ri', 'Неверная сумма', 'Invalid amount'],
  notFound: ['Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found'],
  cannotPerform: ['Amalni bajarib bo\'lmaydi', 'Невозможно выполнить данную операцию', 'Unable to perform operation'],
  account: ['O\'quvchi topilmadi (telefon raqami)', 'Ученик не найден (номер телефона)', 'Student not found (phone number)'],
  internal: ['Ichki xato', 'Системная (внутренняя) ошибка', 'Internal error'],
} as const

const CODES: Record<keyof typeof MESSAGES, number> = {
  auth: -32504,
  parse: -32700,
  request: -32600,
  method: -32601,
  amount: -31001,
  notFound: -31003,
  cannotPerform: -31008,
  account: -31050,
  internal: -32400,
}

function fail(id: RpcId, kind: keyof typeof MESSAGES, data?: string): PaymeResponse {
  const [uz, ru, en] = MESSAGES[kind]
  return { id, error: { code: CODES[kind], message: { uz, ru, en }, ...(data ? { data } : {}) } }
}

const ok = (id: RpcId, result: Record<string, unknown>): PaymeResponse => ({ id, result })

// "Authorization: Basic base64(Paycom:<kalit>)" — asosiy yoki test kaliti
export function paymeAuthorized(header: string | null, config: PaymeConfig | null): boolean {
  if (!config || !header || !header.startsWith('Basic ')) return false
  let decoded: string
  try {
    decoded = atob(header.slice(6).trim())
  } catch {
    return false
  }
  const separator = decoded.indexOf(':')
  if (separator < 0) return false
  const login = decoded.slice(0, separator)
  const password = decoded.slice(separator + 1)
  if (login !== 'Paycom') return false
  return safeEqual(password, config.key) || (Boolean(config.testKey) && safeEqual(password, config.testKey ?? ''))
}

const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)

function validAmount(amount: unknown): amount is number {
  return isInteger(amount) && amount >= MIN_PAYMENT_SOM * 100 && amount <= MAX_PAYMENT_SOM * 100
}

const txTimes = (tx: PaymentTx) => ({
  create_time: tx.createTime,
  perform_time: tx.performTime ?? 0,
  cancel_time: tx.cancelTime ?? 0,
  transaction: tx.id,
  state: tx.state,
  reason: tx.reason,
})

type Checked = { ok: false; error: PaymeResponse } | { ok: true; customer: PaymentCustomer; phone: string; amount: number }

// Hisob va summani tekshirish (CheckPerformTransaction va yangi CreateTransaction uchun umumiy)
async function checkAccount(id: RpcId, params: Record<string, unknown>, ctx: PaymeContext): Promise<Checked> {
  const account = isRecord(params.account) ? params.account : null
  const phone = accountPhone(account?.phone)
  if (!phone) return { ok: false, error: fail(id, 'account', 'phone') }
  const customer = await ctx.store.findCustomer(phone)
  if (!customer) return { ok: false, error: fail(id, 'account', 'phone') }
  if (!validAmount(params.amount)) return { ok: false, error: fail(id, 'amount') }
  return { ok: true, customer, phone, amount: params.amount }
}

// Fiskal chek ma'lumoti (kassa sozlamasida MXIK berilgan bo'lsa)
function receiptDetail(config: PaymeConfig, amount: number, title: string) {
  if (!config.ikpu) return undefined
  return {
    receipt_type: 0,
    items: [
      {
        title,
        price: amount,
        count: 1,
        code: config.ikpu,
        ...(config.packageCode ? { package_code: config.packageCode } : {}),
        vat_percent: config.vatPercent ?? 0,
      },
    ],
  }
}

export async function handlePayme(body: unknown, ctx: PaymeContext): Promise<PaymeResponse> {
  if (!isRecord(body)) return fail(null, 'parse')
  const id: RpcId = typeof body.id === 'number' || typeof body.id === 'string' ? body.id : null
  // Kalit tekshiruvi har qanday metoddan oldin
  if (!paymeAuthorized(ctx.authorization, ctx.config) || !ctx.config) return fail(id, 'auth')
  const config = ctx.config
  if (typeof body.method !== 'string') return fail(id, 'request')
  const params = isRecord(body.params) ? body.params : {}
  try {
    switch (body.method) {
      case 'CheckPerformTransaction': {
        const checked = await checkAccount(id, params, ctx)
        if (!checked.ok) return checked.error
        const detail = receiptDetail(config, checked.amount, `O'quv markazi xizmati: ${checked.customer.name}`.slice(0, 128))
        return ok(id, { allow: true, ...(detail ? { detail } : {}) })
      }

      case 'CreateTransaction': {
        if (typeof params.id !== 'string' || !params.id || !isInteger(params.time)) return fail(id, 'request')
        const existing = await ctx.store.get(params.id)
        if (existing) {
          if (existing.state !== 1) return fail(id, 'cannotPerform')
          if (ctx.now - existing.createTime > PAYME_TIMEOUT_MS) {
            await ctx.store.cancel(existing.providerId, 4, ctx.now)
            return fail(id, 'cannotPerform')
          }
          return ok(id, { create_time: existing.createTime, transaction: existing.id, state: existing.state })
        }
        const checked = await checkAccount(id, params, ctx)
        if (!checked.ok) return checked.error
        if (ctx.now - params.time > PAYME_TIMEOUT_MS) return fail(id, 'cannotPerform')
        const tx = await ctx.store.create({ providerId: params.id, customerId: checked.customer.id, amount: checked.amount, createTime: params.time, account: { phone: checked.phone } })
        return ok(id, { create_time: tx.createTime, transaction: tx.id, state: tx.state })
      }

      case 'PerformTransaction': {
        if (typeof params.id !== 'string') return fail(id, 'request')
        const tx = await ctx.store.get(params.id)
        if (!tx) return fail(id, 'notFound')
        if (tx.state === 2) return ok(id, { transaction: tx.id, perform_time: tx.performTime ?? 0, state: 2 })
        if (tx.state !== 1) return fail(id, 'cannotPerform')
        if (ctx.now - tx.createTime > PAYME_TIMEOUT_MS) {
          await ctx.store.cancel(tx.providerId, 4, ctx.now)
          return fail(id, 'cannotPerform')
        }
        const done = await ctx.store.perform(tx.providerId, ctx.now)
        return ok(id, { transaction: done.id, perform_time: done.performTime ?? ctx.now, state: done.state })
      }

      case 'CancelTransaction': {
        if (typeof params.id !== 'string') return fail(id, 'request')
        const tx = await ctx.store.get(params.id)
        if (!tx) return fail(id, 'notFound')
        const reason = isInteger(params.reason) ? params.reason : null
        const result = tx.state > 0 ? await ctx.store.cancel(tx.providerId, reason, ctx.now) : tx
        return ok(id, { transaction: result.id, cancel_time: result.cancelTime ?? 0, state: result.state })
      }

      case 'CheckTransaction': {
        if (typeof params.id !== 'string') return fail(id, 'request')
        const tx = await ctx.store.get(params.id)
        if (!tx) return fail(id, 'notFound')
        return ok(id, txTimes(tx))
      }

      case 'GetStatement': {
        if (!isInteger(params.from) || !isInteger(params.to)) return fail(id, 'request')
        const list = await ctx.store.statement(params.from, params.to)
        return ok(id, {
          transactions: list.map((tx) => ({ id: tx.providerId, time: tx.createTime, amount: tx.amount, account: tx.account, ...txTimes(tx) })),
        })
      }

      case 'ChangePassword': {
        if (typeof params.password !== 'string' || params.password.length < 8 || !ctx.changeKey) return fail(id, 'request')
        await ctx.changeKey(params.password)
        return ok(id, { success: true })
      }

      default:
        return fail(id, 'method')
    }
  } catch {
    return fail(id, 'internal')
  }
}
