import { describe, expect, it } from 'vitest'
import { ESKIZ_API, ESKIZ_TOKEN_TTL_MS, eskizClient, sendAll, smsPhone } from '../../supabase/functions/_shared/eskiz'
import type { EskizSecret, FetchLike } from '../../supabase/functions/_shared/eskiz'

// Soxta Eskiz: login — token, send — id; token "eskirgan" bo'lsa 401
function fakeEskiz(options: { expired?: Set<string>; loginOk?: boolean; reject?: string } = {}) {
  const calls: Array<{ url: string; auth: string | null; fields: Record<string, string> }> = []
  let issued = 0
  const fetchImpl: FetchLike = async (url, init) => {
    const fields: Record<string, string> = {}
    if (init?.body instanceof FormData) for (const [key, value] of init.body) fields[key] = String(value)
    const auth = new Headers(init?.headers).get('Authorization')
    calls.push({ url, auth, fields })
    if (url === `${ESKIZ_API}/auth/login`) {
      if (options.loginOk === false) return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
      issued += 1
      return new Response(JSON.stringify({ message: 'token_generated', data: { token: `tok${issued}` }, token_type: 'bearer' }))
    }
    const token = auth?.replace('Bearer ', '') ?? ''
    if (options.expired?.has(token)) return new Response(JSON.stringify({ message: 'Expired' }), { status: 401 })
    if (options.reject && fields.message?.includes(options.reject)) return new Response(JSON.stringify({ message: 'Shablon tasdiqlanmagan', status: 'error' }), { status: 400 })
    return new Response(JSON.stringify({ id: `sms-${calls.length}`, message: 'Waiting for SMS provider', status: 'waiting' }))
  }
  return { fetchImpl, calls }
}

const secret: EskizSecret = { email: 'markaz@mail.uz', password: 'parol', from: '4546' }
const NOW = 1_762_600_000_000

describe('Eskiz SMS mijozi', () => {
  it('telefon formati: 998XXXXXXXXX', () => {
    expect(smsPhone('+998 90 123 45 67')).toBe('998901234567')
    expect(smsPhone('901234567')).toBe('998901234567')
    expect(smsPhone('12345')).toBeNull()
  })

  it('birinchi yuborishda login, token saqlanadi; keyingisi tokenni qayta ishlatadi; FormData maydonlari', async () => {
    const { fetchImpl, calls } = fakeEskiz()
    const saved: Array<[string, number]> = []
    const client = eskizClient(secret, fetchImpl, NOW, async (token, at) => void saved.push([token, at]))
    expect(await client.send('+998 90 123 45 67', 'Salom')).toMatchObject({ ok: true, id: 'sms-2' })
    expect(await client.send('931112233', 'Ikkinchi')).toMatchObject({ ok: true })
    expect(saved).toEqual([['tok1', NOW]])
    expect(calls.filter((c) => c.url.endsWith('/auth/login'))).toHaveLength(1)
    expect(calls[1]).toEqual({ url: `${ESKIZ_API}/message/sms/send`, auth: 'Bearer tok1', fields: { mobile_phone: '998901234567', message: 'Salom', from: '4546' } })
  })

  it('saqlangan token amal qilsa login yo\'q; 401 bo\'lsa bir marta qayta login; eski token — login', async () => {
    const fresh = fakeEskiz()
    await eskizClient({ ...secret, token: 'eski', tokenAt: NOW - 1000 }, fresh.fetchImpl, NOW, async () => {}).send('901234567', 'A')
    expect(fresh.calls.map((c) => c.auth)).toEqual(['Bearer eski'])

    const expired = fakeEskiz({ expired: new Set(['eski']) })
    const result = await eskizClient({ ...secret, token: 'eski', tokenAt: NOW - 1000 }, expired.fetchImpl, NOW, async () => {}).send('901234567', 'A')
    expect(result.ok).toBe(true)
    expect(expired.calls.map((c) => c.auth ?? 'login')).toEqual(['Bearer eski', 'login', 'Bearer tok1'])

    const old = fakeEskiz()
    await eskizClient({ ...secret, token: 'eski', tokenAt: NOW - ESKIZ_TOKEN_TTL_MS - 1 }, old.fetchImpl, NOW, async () => {}).send('901234567', 'A')
    expect(old.calls[0].url).toBe(`${ESKIZ_API}/auth/login`)
  })

  it('xatolar: login rad etilsa, telefon noto\'g\'ri, Eskiz matnni rad etsa — sababi bilan', async () => {
    const denied = fakeEskiz({ loginOk: false })
    expect(await eskizClient(secret, denied.fetchImpl, NOW, async () => {}).send('901234567', 'A')).toEqual({ ok: false, status: 401, error: 'login' })
    const { fetchImpl } = fakeEskiz({ reject: 'reklama' })
    const client = eskizClient(secret, fetchImpl, NOW, async () => {})
    expect(await client.send('12', 'A')).toEqual({ ok: false, status: 0, error: 'phone' })
    expect(await client.send('901234567', 'reklama matni')).toEqual({ ok: false, status: 400, error: 'Shablon tasdiqlanmagan' })
  })

  it('bir nechta xabar: natijalar soni va har biri jurnalga', async () => {
    const { fetchImpl } = fakeEskiz({ reject: 'yomon' })
    const client = eskizClient(secret, fetchImpl, NOW, async () => {})
    const logged: string[] = []
    const items = [
      { id: 'c1', phone: '901234567', text: 'yaxshi 1' },
      { id: 'c2', phone: '931112233', text: 'yomon' },
      { id: 'c3', phone: '941112233', text: 'yaxshi 2' },
    ]
    const summary = await sendAll(client, items, async (item, result) => void logged.push(`${item.id}:${result.ok ? 'ok' : result.error}`), 2)
    expect(summary).toEqual({ sent: 2, failed: 1 })
    expect(logged.sort()).toEqual(['c1:ok', 'c2:Shablon tasdiqlanmagan', 'c3:ok'])
  })
})
