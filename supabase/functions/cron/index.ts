// Edge Function "cron": pg_cron + pg_net chaqiradi (DEPLOY.md §7–8), sarlavha: x-cron-secret: <CRON_SECRET>
//   { "task": "outbox" }    — har 5 daqiqada: navbatdagi "dars qoldirildi" va "to'lov qabul qilindi" xabarlari ota-onalar botiga
//   { "task": "reminders" } — har kuni ertalab (yoki body bo'sh): qarzdorlarga avtomatik eslatma
// Eslatma: Sozlamalarda "Avtomatik eslatma" yoqilgan va tarifi faol markazlarda, oxirgi N kunda eslatma olmagan qarzdorlarga.
// Ota-onasi Telegram botga ulangan bo'lsa — bot orqali (bepul, ota-ona tanlagan tilda), qolganlarga — SMS (Eskiz ulangan bo'lsa).
// Qarz ilova bilan aynan bir xil hisoblanadi (generated/engine.js — src/server/engine.ts yig'masi).
// Deploy: supabase functions deploy cron --no-verify-jwt ; supabase secrets set CRON_SECRET=<uzun tasodifiy satr>
import { isTelegramSecret } from '../_shared/bot.ts'
import type { TelegramSecret } from '../_shared/bot.ts'
// @ts-types="../_shared/generated/engine.d.ts"
import { debtorReminders, tashkentNow } from '../_shared/generated/engine.js'
import type { DebtorReminder } from '../_shared/generated/engine.d.ts'
import { eskizClient, isEskizSecret, sendAll } from '../_shared/eskiz.ts'
import type { EskizSecret } from '../_shared/eskiz.ts'
import { safeEqual } from '../_shared/hash.ts'
import { deliverOutbox, isOutboxItem, OUTBOX_GRACE_MS, OUTBOX_MAX_ATTEMPTS } from '../_shared/outbox.ts'
import type { OutboxItem } from '../_shared/outbox.ts'
import { isRecord } from '../_shared/payments.ts'
import { json, serviceClient } from '../_shared/supabase.ts'
import type { SupabaseClient } from '../_shared/supabase.ts'
import { telegramApi } from '../_shared/telegram.ts'
import type { Lang } from '../_shared/telegram.ts'

type Row = Record<string, unknown>
const MAX_PER_ORG = 300
const OUTBOX_BATCH = 300
// Edge Function vaqt chegarasidan oldin to'xtaydi — qolgani keyingi chaqiruvda
const TIME_BUDGET_MS = 100_000
const asLang = (value: unknown): Lang => (value === 'ru' ? 'ru' : 'uz')

function orgActive(o: Row, now: number): boolean {
  if (o.status !== 'active') return false
  const until = o.plan === 'trial' ? o.trial_ends_at : o.paid_until
  return until === null || until === undefined || Date.parse(String(until)) > now
}

async function select(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

const rows = (sb: SupabaseClient, table: string, org: string) => select(sb.from(table).select('*').eq('organization_id', org).limit(50_000))

const loadOrg = async (sb: SupabaseClient, id: string) =>
  (await sb.from('organizations').select('id, status, plan, trial_ends_at, paid_until, settings').eq('id', id).maybeSingle()).data as Row | null

// Bot bog'lanishlari: o'quvchi -> ota-ona chatlari
async function chatsOf(sb: SupabaseClient, org: string, customerIds?: string[]) {
  let query = sb.from('telegram_links').select('customer_id, chat_id, lang').eq('organization_id', org)
  if (customerIds) query = query.in('customer_id', customerIds.length ? customerIds : [''])
  const chats = new Map<string, Array<{ chatId: number; lang: Lang }>>()
  for (const l of await select(query)) {
    const list = chats.get(String(l.customer_id)) ?? []
    list.push({ chatId: Number(l.chat_id), lang: asLang(l.lang) })
    chats.set(String(l.customer_id), list)
  }
  return chats
}

const unlinkChat = async (sb: SupabaseClient, org: string, customerId: string, chatId: number) => {
  await sb.from('telegram_links').delete().eq('organization_id', org).eq('customer_id', customerId).eq('chat_id', chatId)
}

// ===== Kunlik avtomatik eslatma =====
async function remindOrg(sb: SupabaseClient, org: Row, channels: { eskiz?: unknown; telegram?: unknown }, now: number) {
  const id = String(org.id)
  const settings = isRecord(org.settings) ? org.settings : {}
  const eskiz: EskizSecret | null = isEskizSecret(channels.eskiz) ? channels.eskiz : null
  const bot: TelegramSecret | null = isTelegramSecret(channels.telegram) ? channels.telegram : null
  if (settings.autoReminders !== true || (!eskiz && !bot)) return null
  const everyDays = Math.min(30, Math.max(3, Math.round(Number(settings.autoRemindEveryDays) || 7)))
  const lang = asLang(settings.autoRemindLang)
  const [customers, courses, transactions, groups, enrollments] = await Promise.all(
    ['customers', 'courses', 'transactions', 'groups', 'enrollments'].map((table) => rows(sb, table, id)),
  )
  const data = { settings, customers, courses, transactions, groups, enrollments }
  const debtors = debtorReminders(data, { now: tashkentNow(now), lang, withLink: true })
  // Shu davrda eslatma olganlar (avtomatik, SMS, bot yoki xodim WhatsApp/Telegram orqali yuborgan) qayta olmaydi
  const since = new Date(now - everyDays * 86_400_000).toISOString()
  const recent = await select(sb.from('audit_log').select('entity_id').eq('organization_id', id).eq('action', 'reminder.sent').gte('at', since).limit(50_000))
  const reminded = new Set(recent.map((r) => String(r.entity_id)))
  const targets = debtors.filter((d) => !reminded.has(d.customerId)).slice(0, MAX_PER_ORG)
  const audit = (item: DebtorReminder, channel: string) =>
    sb.from('audit_log').insert({ organization_id: id, user_name: 'Avtomatik eslatma', action: 'reminder.sent', summary: `${item.name} · ${channel}`.slice(0, 200), entity_id: item.customerId })

  // 1) Botga ulangan ota-onalar — bot orqali, o'z tilida
  const chats = bot ? await chatsOf(sb, id, targets.map((t) => t.customerId)) : new Map<string, Array<{ chatId: number; lang: Lang }>>()
  const needsOther = [...chats.values()].some((list) => list.some((c) => c.lang !== lang))
  const other = new Map(needsOther ? debtorReminders(data, { now: tashkentNow(now), lang: lang === 'uz' ? 'ru' : 'uz', withLink: true }).map((d) => [d.customerId, d.text]) : [])
  const api = bot ? telegramApi(bot.token, fetch) : null
  const viaBot = async (item: DebtorReminder) => {
    if (!api) return false
    let delivered = false
    for (const chat of chats.get(item.customerId) ?? []) {
      const text = chat.lang === lang ? item.text : (other.get(item.customerId) ?? item.text)
      const result = await api.sendMessage(chat.chatId, text, null, chat.lang).catch(() => null)
      if (result?.ok) delivered = true
      else if (result?.status === 403) await unlinkChat(sb, id, item.customerId, chat.chatId)
    }
    return delivered
  }
  const viaSms: DebtorReminder[] = []
  let botSent = 0
  for (const item of targets) {
    if (await viaBot(item)) {
      botSent += 1
      await audit(item, 'Telegram bot')
    } else viaSms.push(item)
  }

  // 2) Qolganlari — SMS (Eskiz ulangan bo'lsa)
  if (!eskiz) return { org: id, debtors: debtors.length, bot: botSent, sms: 0, skipped: viaSms.length }
  const client = eskizClient(eskiz, fetch, now, async (token, at) => {
    await sb.from('integration_secrets').update({ secret: { ...eskiz, token, tokenAt: at } }).eq('organization_id', id).eq('provider', 'eskiz')
  })
  const summary = await sendAll(client, viaSms, async (item, result) => {
    const digits = item.phone.replace(/\D/g, '').slice(-12)
    if (digits.length >= 9) {
      await sb.from('sms_log').insert({
        organization_id: id,
        customer_id: item.customerId,
        phone: digits,
        text: item.text.slice(0, 1000),
        kind: 'auto',
        status: result.ok ? 'sent' : 'failed',
        provider_id: result.id ?? null,
        error: result.ok ? null : (result.error ?? 'error').slice(0, 300),
      })
    }
    if (result.ok) await audit(item, 'SMS')
  })
  return { org: id, debtors: debtors.length, bot: botSent, sms: summary.sent, smsFailed: summary.failed }
}

async function reminders(sb: SupabaseClient, now: number) {
  const secrets = await select(sb.from('integration_secrets').select('organization_id, provider, secret').in('provider', ['eskiz', 'telegram']))
  const byOrg = new Map<string, { eskiz?: unknown; telegram?: unknown }>()
  for (const s of secrets) {
    const entry = byOrg.get(String(s.organization_id)) ?? {}
    if (s.provider === 'eskiz') entry.eskiz = s.secret
    else entry.telegram = s.secret
    byOrg.set(String(s.organization_id), entry)
  }
  // Bir necha marta chaqirish xavfsiz (eslatma olganlar o'tkazib yuboriladi): vaqt tugasa qolgan markazlar keyingi chaqiruvda
  const started = Date.now()
  const report: unknown[] = []
  for (const [orgId, channels] of byOrg) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      report.push({ deferred: true })
      break
    }
    const org = await loadOrg(sb, orgId)
    if (!org || !orgActive(org, now)) continue
    try {
      const result = await remindOrg(sb, org, channels, now)
      if (result) report.push(result)
    } catch (e) {
      report.push({ org: orgId, error: e instanceof Error ? e.message : 'error' })
    }
  }
  return report
}

// ===== Xabarlar navbati (har 5 daqiqada) =====
async function outboxOrg(sb: SupabaseClient, orgId: string, items: OutboxItem[], now: number) {
  const finish = async (ids: number[], error: string | null) => {
    if (ids.length) await sb.from('notification_outbox').update({ sent_at: new Date(now).toISOString(), error }).in('id', ids)
  }
  const [org, secretRow] = await Promise.all([loadOrg(sb, orgId), sb.from('integration_secrets').select('secret').eq('organization_id', orgId).eq('provider', 'telegram').maybeSingle()])
  const secret = secretRow.data?.secret
  if (!org || !orgActive(org, now) || !isTelegramSecret(secret)) {
    await finish(items.map((i) => i.id), 'inactive')
    return { org: orgId, skipped: items.length }
  }
  const settings = isRecord(org.settings) ? org.settings : {}
  const ids = [...new Set(items.map((i) => i.customerId))]
  const groupIds = [...new Set(items.map((i) => String(i.payload.group_id ?? '')).filter(Boolean))]
  const dates = [...new Set(items.filter((i) => i.kind === 'absence').map((i) => String(i.payload.date ?? '').slice(0, 10)).filter(Boolean))]
  const txIds = [...new Set(items.filter((i) => i.kind === 'payment').map((i) => String(i.payload.transaction_id ?? '')).filter(Boolean))]
  const [customers, groups, attendance, transactions, chats] = await Promise.all([
    select(sb.from('customers').select('id, name').eq('organization_id', orgId).is('deleted_at', null).in('id', ids)),
    select(sb.from('groups').select('id, name').eq('organization_id', orgId).in('id', groupIds.length ? groupIds : [''])),
    select(sb.from('attendance').select('group_id, customer_id, date, status').eq('organization_id', orgId).in('customer_id', ids).in('date', dates.length ? dates : ['1970-01-01'])),
    select(sb.from('transactions').select('id, status, deleted_at').eq('organization_id', orgId).in('id', txIds.length ? txIds : [''])),
    chatsOf(sb, orgId, ids),
  ])
  const absent = new Set(attendance.filter((a) => a.status === 'absent').map((a) => `${a.customer_id}|${a.group_id}|${String(a.date).slice(0, 10)}`))
  const paid = new Set(transactions.filter((t) => t.status === 'paid' && !t.deleted_at).map((t) => String(t.id)))
  const api = telegramApi(secret.token, fetch)
  const outcomes = await deliverOutbox(items, {
    now,
    today: tashkentNow(now).toISOString().slice(0, 10),
    currency: settings.currency === 'USD' ? 'USD' : 'UZS',
    enabled: { absence: settings.botAbsenceAlerts !== false, payment: settings.botPaymentAlerts !== false },
    customers: new Map(customers.map((c) => [String(c.id), String(c.name)])),
    groups: new Map(groups.map((g) => [String(g.id), String(g.name)])),
    chats,
    stillValid: (item) =>
      item.kind === 'absence'
        ? absent.has(`${item.customerId}|${String(item.payload.group_id ?? '')}|${String(item.payload.date ?? '').slice(0, 10)}`)
        : paid.has(String(item.payload.transaction_id ?? '')),
    send: (chatId, text, lang) => api.sendMessage(chatId, text, null, lang),
    unlink: (customerId, chatId) => unlinkChat(sb, orgId, customerId, chatId),
  })
  for (const o of outcomes) {
    if (o.done) await finish([o.id], o.error)
    else await sb.from('notification_outbox').update({ attempts: (items.find((i) => i.id === o.id)?.attempts ?? 0) + 1, error: o.error }).eq('id', o.id)
  }
  return { org: orgId, items: items.length, delivered: outcomes.filter((o) => o.delivered > 0).length }
}

async function outbox(sb: SupabaseClient, now: number) {
  const started = Date.now()
  const pending = await select(
    sb
      .from('notification_outbox')
      .select('id, organization_id, customer_id, kind, payload, created_at, attempts')
      .is('sent_at', null)
      .lt('attempts', OUTBOX_MAX_ATTEMPTS)
      .lte('created_at', new Date(now - OUTBOX_GRACE_MS).toISOString())
      .order('created_at')
      .limit(OUTBOX_BATCH),
  )
  const byOrg = new Map<string, OutboxItem[]>()
  for (const r of pending) {
    const item = { id: Number(r.id), customerId: String(r.customer_id), kind: r.kind, payload: isRecord(r.payload) ? r.payload : {}, createdAt: String(r.created_at), attempts: Number(r.attempts) || 0 }
    if (!isOutboxItem(item)) continue
    byOrg.set(String(r.organization_id), [...(byOrg.get(String(r.organization_id)) ?? []), item])
  }
  const report: unknown[] = []
  for (const [orgId, items] of byOrg) {
    if (Date.now() - started > TIME_BUDGET_MS) break
    try {
      report.push(await outboxOrg(sb, orgId, items, now))
    } catch (e) {
      report.push({ org: orgId, error: e instanceof Error ? e.message : 'error' })
    }
  }
  // 30 kundan eski yozuvlar tozalanadi
  await sb.from('notification_outbox').delete().lt('created_at', new Date(now - 30 * 86_400_000).toISOString())
  return report
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET') ?? ''
  if (!expected || !safeEqual(req.headers.get('x-cron-secret') ?? '', expected)) return json(401, { error: 'auth' })
  const body: unknown = await req.json().catch(() => ({}))
  const task = isRecord(body) && body.task === 'outbox' ? 'outbox' : 'reminders'
  const sb = serviceClient()
  try {
    const report = task === 'outbox' ? await outbox(sb, Date.now()) : await reminders(sb, Date.now())
    return json(200, { ok: true, task, report })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'error' })
  }
})
