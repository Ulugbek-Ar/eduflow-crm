// Integratsiya kalitlarini tekshirish (Edge Function "integrations" administrator yuborganini saqlashdan oldin).
// Xato — maydon kodi bilan qaytadi, matnni ilova o'z tilida ko'rsatadi
import { isRecord } from './payments.ts'

export const INTEGRATION_PROVIDERS = ['payme', 'click', 'eskiz', 'telegram'] as const
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number]

export const isIntegrationProvider = (value: unknown): value is IntegrationProvider =>
  typeof value === 'string' && (INTEGRATION_PROVIDERS as readonly string[]).includes(value)

export type SecretResult = { ok: true; secret: Record<string, unknown> } | { ok: false; field: string }

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

// Yangi qiymat bo'sh bo'lsa — avvalgisi qoladi (kalitni qayta kiritmasdan boshqa maydonni o'zgartirish mumkin)
function keep(input: Record<string, unknown>, previous: Record<string, unknown>, key: string): string {
  return text(input[key]) || text(previous[key])
}

export function parseSecret(provider: IntegrationProvider, input: unknown, previous: Record<string, unknown> = {}): SecretResult {
  if (!isRecord(input)) return { ok: false, field: 'body' }
  switch (provider) {
    case 'payme': {
      const key = keep(input, previous, 'key')
      if (key.length < 10 || key.length > 200) return { ok: false, field: 'key' }
      const testKey = keep(input, previous, 'testKey')
      if (testKey && (testKey.length < 10 || testKey.length > 200)) return { ok: false, field: 'testKey' }
      const ikpu = text(input.ikpu ?? previous.ikpu)
      if (ikpu && !/^\d{17}$/.test(ikpu)) return { ok: false, field: 'ikpu' }
      const packageCode = text(input.packageCode ?? previous.packageCode)
      if (packageCode && !/^\d{1,20}$/.test(packageCode)) return { ok: false, field: 'packageCode' }
      const vat = Number(input.vatPercent ?? previous.vatPercent ?? 0)
      if (!Number.isInteger(vat) || vat < 0 || vat > 100) return { ok: false, field: 'vatPercent' }
      return { ok: true, secret: { key, ...(testKey ? { testKey } : {}), ...(ikpu ? { ikpu } : {}), ...(packageCode ? { packageCode } : {}), vatPercent: vat } }
    }
    case 'click': {
      const serviceId = text(input.serviceId ?? previous.serviceId)
      if (!/^\d{1,10}$/.test(serviceId)) return { ok: false, field: 'serviceId' }
      const secretKey = keep(input, previous, 'secretKey')
      if (secretKey.length < 6 || secretKey.length > 200) return { ok: false, field: 'secretKey' }
      return { ok: true, secret: { serviceId, secretKey } }
    }
    case 'eskiz': {
      const email = text(input.email ?? previous.email).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, field: 'email' }
      const password = keep(input, previous, 'password')
      if (password.length < 4 || password.length > 200) return { ok: false, field: 'password' }
      const from = text(input.from ?? previous.from) || '4546'
      if (!/^[\w.-]{2,11}$/.test(from)) return { ok: false, field: 'from' }
      return { ok: true, secret: { email, password, from } }
    }
    case 'telegram': {
      const token = keep(input, previous, 'token')
      if (!/^\d{5,15}:[\w-]{30,60}$/.test(token)) return { ok: false, field: 'token' }
      return { ok: true, secret: { token } }
    }
  }
}

// Administratorga qaytariladigan holat: kalitlarning o'zi emas, faqat ulanganmi va oxirgi 4 belgi
export function maskSecret(provider: IntegrationProvider, secret: Record<string, unknown>): Record<string, string | boolean> {
  const tail = (value: unknown) => {
    const s = text(value)
    return s ? `…${s.slice(-4)}` : ''
  }
  switch (provider) {
    case 'payme':
      return { key: tail(secret.key), testKey: tail(secret.testKey), ikpu: text(secret.ikpu), fiscal: Boolean(text(secret.ikpu)) }
    case 'click':
      return { serviceId: text(secret.serviceId), secretKey: tail(secret.secretKey) }
    case 'eskiz':
      return { email: text(secret.email), from: text(secret.from) }
    case 'telegram':
      return { token: tail(secret.token), username: text(secret.username) }
  }
}
