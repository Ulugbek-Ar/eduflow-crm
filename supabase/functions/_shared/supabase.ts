// Faqat Edge Function'lar uchun (Deno): Supabase mijozi, CORS, chaqiruvchi xodim va SQL funksiyalari asosidagi to'lov ombori.
// Vitest bu faylni import qilmaydi (npm: spetsifikatori Deno'ga xos)
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { allocatePayment, pickDebtor, tashkentNow } from './generated/engine.js'
import type { PaymentProvider, PaymentStore, PaymentTx } from './payments.ts'

export type { SupabaseClient }

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(status: number, body: unknown, headers: Record<string, string> = cors): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } })
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const env = (name: string): string => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} berilmagan`)
  return value
}

// service_role — RLS'siz (faqat serverda)
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
}

export interface Caller {
  client: SupabaseClient
  id: string
  orgId: string
  can: (permission: string) => Promise<boolean>
}

// Ilovadan chaqirilganda: xodim tokeni bilan profil va ruxsat tekshiriladi (ruxsatlar jadvali — SQL has_permission())
export async function callerFromRequest(req: Request): Promise<Caller | null> {
  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return null
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data } = await client.from('profiles').select('id, organization_id, status').maybeSingle()
  if (!data || data.status !== 'active') return null
  return {
    client,
    id: String(data.id),
    orgId: String(data.organization_id),
    can: async (permission) => {
      const { data: allowed } = await client.rpc('has_permission', { p: permission })
      return allowed === true
    },
  }
}

type Row = Record<string, unknown>

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value))

function toTx(r: Row): PaymentTx {
  return {
    provider: r.provider as PaymentProvider,
    providerId: String(r.provider_id),
    id: String(r.id),
    num: Number(r.num),
    customerId: r.customer_id === null || r.customer_id === undefined ? null : String(r.customer_id),
    amount: Number(r.amount),
    state: Number(r.state) as PaymentTx['state'],
    createTime: Number(r.create_time),
    performTime: num(r.perform_time),
    cancelTime: num(r.cancel_time),
    reason: num(r.reason),
    account: (r.account ?? {}) as Record<string, string>,
    isTest: r.is_test === true,
  }
}

async function selectRows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

// Qarz hisobi uchun o'quvchilar qatorlari (engine: pickDebtor, allocatePayment)
async function paymentRows(sb: SupabaseClient, org: string, ids: string[]) {
  const [orgRows, customers, courses, transactions, groups, enrollments] = await Promise.all([
    selectRows(sb.from('organizations').select('settings').eq('id', org)),
    selectRows(sb.from('customers').select('*').eq('organization_id', org).in('id', ids)),
    selectRows(sb.from('courses').select('*').eq('organization_id', org)),
    selectRows(sb.from('transactions').select('*').eq('organization_id', org).in('customer_id', ids)),
    selectRows(sb.from('groups').select('*').eq('organization_id', org)),
    selectRows(sb.from('enrollments').select('*').eq('organization_id', org).in('customer_id', ids)),
  ])
  return { settings: orgRows[0]?.settings ?? {}, customers, courses, transactions, groups, enrollments }
}

// To'lov ombori: supabase/migrations/ dagi pay_* funksiyalari (20261123000000_payments_split.sql — id, bo'lib yozish)
export function paymentStore(sb: SupabaseClient, org: string, provider: PaymentProvider, label: string): PaymentStore {
  const rows = async (fn: string, args: Row): Promise<PaymentTx[]> => {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw new Error(error.message)
    return ((data ?? []) as Row[]).map(toTx)
  }
  const first = async (fn: string, args: Row): Promise<PaymentTx> => {
    const [tx] = await rows(fn, args)
    if (!tx) throw new Error(`${fn}: natija yo'q`)
    return tx
  }
  const key = (providerId: string) => ({ p_org: org, p_provider: provider, p_provider_id: providerId })
  return {
    findCustomer: async (ref) => {
      const { data, error } = await sb.rpc('pay_find_customers', { p_org: org, p_customer: ref.customerId ?? null, p_phone: ref.phone ?? null })
      if (error) throw new Error(error.message)
      const list = ((data ?? []) as Row[]).map((row) => ({ id: String(row.id), name: String(row.name) }))
      if (list.length <= 1) return list[0] ?? null
      // Bitta telefonda bir nechta o'quvchi: qarzi bor yagona o'quvchi, aks holda bog'lanmagan
      const ids = list.map((c) => c.id)
      const debtor = pickDebtor(await paymentRows(sb, org, ids), ids, tashkentNow(Date.now()))
      return list.find((c) => c.id === debtor) ?? 'ambiguous'
    },
    get: async (providerId) => (await rows('pay_tx_get', key(providerId)))[0] ?? null,
    create: (input) =>
      first('pay_tx_create', { ...key(input.providerId), p_customer: input.customerId, p_amount: input.amount, p_create_time: input.createTime, p_account: input.account, p_is_test: input.isTest ?? false }),
    perform: async (providerId, now) => {
      // Bir nechta o'qish: summa qarzi eng eski o'qishdan boshlab bo'linadi (bajarilgan bo'lsa — SQL o'zgarishsiz qaytaradi)
      const [tx] = await rows('pay_tx_get', key(providerId))
      let split: Array<{ enrollment: string | null; amount: number }> | null = null
      if (tx && tx.state === 1 && tx.customerId) {
        const parts = allocatePayment(await paymentRows(sb, org, [tx.customerId]), tx.customerId, Math.max(1, Math.round(tx.amount / 100)), tashkentNow(Date.now()))
        split = parts.map((p) => ({ enrollment: p.enrollmentId, amount: p.amount }))
      }
      return first('pay_tx_perform', { ...key(providerId), p_time: now, p_label: label, p_split: split })
    },
    cancel: (providerId, reason, now) => first('pay_tx_cancel', { ...key(providerId), p_time: now, p_reason: reason, p_label: label }),
    statement: (from, to) => rows('pay_tx_statement', { p_org: org, p_provider: provider, p_from: from, p_to: to }),
  }
}

// Markazning maxfiy sozlamasi (integration_secrets)
export async function loadSecret(sb: SupabaseClient, org: string, provider: string): Promise<Row | null> {
  const { data } = await sb.from('integration_secrets').select('secret').eq('organization_id', org).eq('provider', provider).maybeSingle()
  return data && typeof data.secret === 'object' && data.secret !== null ? (data.secret as Row) : null
}
