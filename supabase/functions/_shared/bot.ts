// Faqat Edge Function'lar (Deno): Telegram bot ombori — telegram_links, mijozlar va o'quvchi hisobotlari (service_role).
// @ts-types="./generated/engine.d.ts"
import { customerReports, tashkentNow } from './generated/engine.js'
import type { SupabaseClient } from './supabase.ts'
import { parseLinkCode } from './telegram.ts'
import type { BotStore, Lang, LinkedStudent } from './telegram.ts'

type Row = Record<string, unknown>

export interface TelegramSecret {
  token: string
  username: string
  webhookSecret: string
}

export function isTelegramSecret(value: unknown): value is TelegramSecret {
  return typeof value === 'object' && value !== null && typeof (value as Row).token === 'string' && typeof (value as Row).webhookSecret === 'string'
}

const asLang = (value: unknown): Lang => (value === 'ru' ? 'ru' : 'uz')

async function select(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

// O'quvchi hisobotlari uchun faqat kerakli qatorlar: shu o'quvchilarning to'lov, o'qish va oxirgi 31 kun davomati
export async function loadReports(sb: SupabaseClient, org: string, settings: unknown, ids: string[], lang: Lang) {
  if (ids.length === 0) return []
  const now = tashkentNow(Date.now())
  const since = new Date(now.getTime() - 31 * 86_400_000).toISOString().slice(0, 10)
  const [customers, courses, transactions, groups, enrollments, attendance] = await Promise.all([
    select(sb.from('customers').select('*').eq('organization_id', org).in('id', ids)),
    select(sb.from('courses').select('*').eq('organization_id', org)),
    select(sb.from('transactions').select('*').eq('organization_id', org).in('customer_id', ids)),
    select(sb.from('groups').select('*').eq('organization_id', org)),
    select(sb.from('enrollments').select('*').eq('organization_id', org).in('customer_id', ids)),
    select(sb.from('attendance').select('*').eq('organization_id', org).in('customer_id', ids).gte('date', since)),
  ])
  return customerReports({ settings, customers, courses, transactions, groups, enrollments, attendance }, ids, { now, lang })
}

export function botStore(sb: SupabaseClient, org: string, secret: TelegramSecret, settings: unknown): BotStore {
  const names = async (ids: string[]) =>
    ids.length === 0 ? [] : await select(sb.from('customers').select('id, name').eq('organization_id', org).is('deleted_at', null).in('id', ids))
  const link = async (customerId: string, name: string, chatId: number, lang: Lang): Promise<LinkedStudent> => {
    const { error } = await sb.from('telegram_links').upsert({ organization_id: org, customer_id: customerId, chat_id: chatId, lang }, { onConflict: 'organization_id,customer_id,chat_id' })
    if (error) throw new Error(error.message)
    return { customerId, name, lang }
  }
  return {
    linkByCode: async (code, chatId, lang) => {
      const id = await parseLinkCode(secret.webhookSecret, code)
      if (!id) return null
      const [customer] = await names([id])
      return customer ? link(id, String(customer.name), chatId, lang) : null
    },
    linkByPhone: async (phone, chatId, lang) => {
      const { data, error } = await sb.rpc('pay_find_customer', { p_org: org, p_phone: phone })
      if (error) throw new Error(error.message)
      const found = (data ?? []) as Row[]
      return Promise.all(found.map((c) => link(String(c.id), String(c.name), chatId, lang)))
    },
    linked: async (chatId) => {
      const links = await select(sb.from('telegram_links').select('customer_id, lang').eq('organization_id', org).eq('chat_id', chatId))
      const known = new Map((await names(links.map((l) => String(l.customer_id)))).map((c) => [String(c.id), String(c.name)]))
      return links.flatMap((l) => {
        const name = known.get(String(l.customer_id))
        return name ? [{ customerId: String(l.customer_id), name, lang: asLang(l.lang) }] : []
      })
    },
    unlink: async (chatId) => {
      const { data, error } = await sb.from('telegram_links').delete().eq('organization_id', org).eq('chat_id', chatId).select('customer_id')
      if (error) throw new Error(error.message)
      return (data ?? []).length
    },
    setLang: async (chatId, lang) => {
      const { error } = await sb.from('telegram_links').update({ lang }).eq('organization_id', org).eq('chat_id', chatId)
      if (error) throw new Error(error.message)
    },
    reports: (ids, lang) => loadReports(sb, org, settings, ids, lang),
  }
}
