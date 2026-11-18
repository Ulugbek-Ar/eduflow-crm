// Eskiz.uz SMS API mijozi (sof: fetch tashqaridan beriladi — Edge Function'da global fetch, testlarda soxtasi).
// Token 30 kun amal qiladi: 25 kunda yangilanadi yoki 401 kelsa bir marta qayta kiriladi.
// Eslatma: Eskiz matn shablonlarini moderatsiya qiladi; sinov hisobida faqat "This is test from Eskiz" yuboriladi.
import { isRecord } from './payments.ts'

export const ESKIZ_API = 'https://notify.eskiz.uz/api'
export const ESKIZ_TOKEN_TTL_MS = 25 * 24 * 3_600_000
export const ESKIZ_TEST_TEXT = 'This is test from Eskiz'

export interface EskizSecret {
  email: string
  password: string
  // Jo'natuvchi nomi (tasdiqlangan) yoki standart "4546"
  from: string
  token?: string
  tokenAt?: number
}

export function isEskizSecret(value: unknown): value is EskizSecret {
  return isRecord(value) && typeof value.email === 'string' && typeof value.password === 'string' && typeof value.from === 'string'
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface SmsResult {
  ok: boolean
  status: number
  id?: string
  error?: string
}

// Telefon -> Eskiz formati: 998XXXXXXXXX
export function smsPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) return digits
  if (digits.length === 9 && /^[1-9]/.test(digits)) return `998${digits}`
  return null
}

export async function eskizLogin(email: string, password: string, fetchImpl: FetchLike): Promise<string | null> {
  const body = new FormData()
  body.set('email', email)
  body.set('password', password)
  const res = await fetchImpl(`${ESKIZ_API}/auth/login`, { method: 'POST', body })
  if (!res.ok) return null
  const data: unknown = await res.json().catch(() => null)
  return isRecord(data) && isRecord(data.data) && typeof data.data.token === 'string' ? data.data.token : null
}

export async function eskizSendOne(token: string, phone: string, text: string, from: string, fetchImpl: FetchLike): Promise<SmsResult> {
  const body = new FormData()
  body.set('mobile_phone', phone)
  body.set('message', text)
  body.set('from', from)
  const res = await fetchImpl(`${ESKIZ_API}/message/sms/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })
  const data: unknown = await res.json().catch(() => null)
  if (res.ok && isRecord(data) && data.id !== undefined && data.id !== null) return { ok: true, status: res.status, id: String(data.id) }
  const message = isRecord(data) && typeof data.message === 'string' ? data.message : `HTTP ${res.status}`
  return { ok: false, status: res.status, error: message.slice(0, 300) }
}

export interface EskizClient {
  send: (phone: string, text: string) => Promise<SmsResult>
}

// onToken — yangi tokenni saqlash (integration_secrets), keyingi chaqiruvlar qayta kirmasin
export function eskizClient(secret: EskizSecret, fetchImpl: FetchLike, now: number, onToken: (token: string, at: number) => Promise<void>): EskizClient {
  let token = secret.token && secret.tokenAt && now - secret.tokenAt < ESKIZ_TOKEN_TTL_MS ? secret.token : null
  const login = async (): Promise<string | null> => {
    const fresh = await eskizLogin(secret.email, secret.password, fetchImpl)
    if (fresh) {
      token = fresh
      await onToken(fresh, now)
    }
    return fresh
  }
  return {
    async send(phone, text) {
      const target = smsPhone(phone)
      if (!target) return { ok: false, status: 0, error: 'phone' }
      const current = token ?? (await login())
      if (!current) return { ok: false, status: 401, error: 'login' }
      const first = await eskizSendOne(current, target, text, secret.from, fetchImpl)
      if (first.status !== 401) return first
      const renewed = await login()
      return renewed ? eskizSendOne(renewed, target, text, secret.from, fetchImpl) : { ok: false, status: 401, error: 'login' }
    },
  }
}

// Bir nechta xabar: bir vaqtda ko'pi bilan `parallel` ta so'rov; har natija onResult'ga (jurnal uchun)
export async function sendAll<T extends { phone: string; text: string }>(
  client: EskizClient,
  items: readonly T[],
  onResult: (item: T, result: SmsResult) => Promise<void>,
  parallel = 4,
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      const result = await client.send(item.phone, item.text).catch((): SmsResult => ({ ok: false, status: 0, error: 'network' }))
      if (result.ok) sent += 1
      else failed += 1
      await onResult(item, result)
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, items.length) }, worker))
  return { sent, failed }
}
