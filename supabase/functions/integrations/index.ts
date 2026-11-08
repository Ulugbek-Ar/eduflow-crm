// Edge Function "integrations": administrator to'lov tizimlari va xabar xizmatlarini ulaydi.
// Kalitlar faqat serverda saqlanadi (integration_secrets); ilovaga faqat holat va oxirgi 4 belgi qaytadi.
// Chaqirish: supabase.functions.invoke('integrations', { body: { action, ... } })
//   status | save { provider, secret } | remove { provider } — administrator (settings.manage)
//   sms.send { messages: [{ customerId, text }] } — eslatma yuboruvchi (payments.create yoki customers.edit)
//   sms.test { phone, text? } — administrator
//   telegram.link { customerId } | telegram.send { messages } | telegram.unlink { customerId } — ota-onalar boti
// Deploy: supabase functions deploy integrations
import { isTelegramSecret } from '../_shared/bot.ts'
import { ESKIZ_TEST_TEXT, eskizClient, eskizLogin, isEskizSecret, sendAll } from '../_shared/eskiz.ts'
import type { EskizSecret, SmsResult } from '../_shared/eskiz.ts'
import { isIntegrationProvider, maskSecret, parseSecret } from '../_shared/integrations.ts'
import type { IntegrationProvider } from '../_shared/integrations.ts'
import { isRecord } from '../_shared/payments.ts'
import { callerFromRequest, cors, json, loadSecret, serviceClient } from '../_shared/supabase.ts'
import type { Caller, SupabaseClient } from '../_shared/supabase.ts'
import { linkCode, telegramApi } from '../_shared/telegram.ts'
import type { Lang } from '../_shared/telegram.ts'

const LABELS: Record<IntegrationProvider, string> = { payme: 'Payme', click: 'Click', eskiz: 'Eskiz SMS', telegram: 'Telegram bot' }
// Shu bosqichda ulanadiganlar (Telegram — keyingi bosqichda o'z tekshiruvi bilan)
const SAVABLE: readonly IntegrationProvider[] = ['payme', 'click', 'eskiz', 'telegram']

const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')

const canRemind = async (caller: Caller) => (await caller.can('payments.create')) || (await caller.can('customers.edit'))
const MAX_SMS = 300

// Eskiz: yangi token integration_secrets'ga yoziladi (keyingi yuborishda qayta kirilmaydi)
function smsClient(sb: SupabaseClient, org: string, secret: EskizSecret) {
  return eskizClient(secret, fetch, Date.now(), async (token, at) => {
    await sb.from('integration_secrets').update({ secret: { ...secret, token, tokenAt: at } }).eq('organization_id', org).eq('provider', 'eskiz')
  })
}

async function logSms(sb: SupabaseClient, caller: Caller, row: { customerId: string | null; phone: string; text: string; kind: string }, result: SmsResult) {
  await sb.from('sms_log').insert({
    organization_id: caller.orgId,
    customer_id: row.customerId,
    phone: row.phone,
    text: row.text.slice(0, 1000),
    kind: row.kind,
    status: result.ok ? 'sent' : 'failed',
    provider_id: result.id ?? null,
    error: result.ok ? null : (result.error ?? 'error').slice(0, 300),
    created_by: caller.id,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const caller = await callerFromRequest(req)
  if (!caller) return json(401, { error: 'auth' })
  const body: unknown = await req.json().catch(() => ({}))
  if (!isRecord(body)) return json(400, { error: 'body' })
  const sb = serviceClient()

  if (body.action === 'status') {
    if (!(await caller.can('settings.manage'))) return json(403, { error: 'forbidden' })
    const { data, error } = await sb.from('integration_secrets').select('provider, secret, updated_at').eq('organization_id', caller.orgId)
    if (error) return json(500, { error: 'db' })
    const status: Record<string, unknown> = {}
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      if (!isIntegrationProvider(row.provider) || !isRecord(row.secret)) continue
      status[row.provider] = { configured: true, updatedAt: row.updated_at, ...maskSecret(row.provider, row.secret) }
    }
    return json(200, { status })
  }

  if (body.action === 'save' || body.action === 'remove') {
    if (!(await caller.can('settings.manage'))) return json(403, { error: 'forbidden' })
    const { data: writable } = await caller.client.rpc('org_writable')
    if (!writable) return json(403, { error: 'readonly' })
    const provider = body.provider
    if (!isIntegrationProvider(provider)) return json(400, { error: 'provider' })

    if (body.action === 'remove') {
      // Bot: webhook o'chiriladi (bog'langan ota-onalar saqlanadi — o'sha bot qayta ulansa ishlayveradi)
      if (provider === 'telegram') {
        const old = await loadSecret(sb, caller.orgId, 'telegram')
        if (isTelegramSecret(old)) await telegramApi(old.token, fetch).deleteWebhook().catch(() => null)
      }
      const { error } = await sb.from('integration_secrets').delete().eq('organization_id', caller.orgId).eq('provider', provider)
      if (error) return json(500, { error: 'db' })
      await caller.client.rpc('log_event', { p_action: 'settings.update', p_summary: `${LABELS[provider]}: o'chirildi` })
      return json(200, { ok: true })
    }

    if (!SAVABLE.includes(provider)) return json(400, { error: 'provider' })
    const previous = (await loadSecret(sb, caller.orgId, provider)) ?? {}
    const parsed = parseSecret(provider, body.secret, previous)
    if (!parsed.ok) return json(400, { error: 'invalid', field: parsed.field })
    // Eskiz: login va parol darhol tekshiriladi, token saqlanadi
    if (provider === 'eskiz') {
      const token = await eskizLogin(String(parsed.secret.email), String(parsed.secret.password), fetch).catch(() => null)
      if (!token) return json(400, { error: 'invalid', field: 'password' })
      parsed.secret.token = token
      parsed.secret.tokenAt = Date.now()
    }
    // Telegram: token getMe bilan tekshiriladi, webhook maxfiy kalit bilan o'rnatiladi
    if (provider === 'telegram') {
      const api = telegramApi(String(parsed.secret.token), fetch)
      const me = await api.getMe().catch(() => null)
      const username = me?.ok && isRecord(me.result) && typeof me.result.username === 'string' ? me.result.username : ''
      if (!username) return json(400, { error: 'invalid', field: 'token' })
      const webhookSecret = isTelegramSecret(previous) && previous.token === parsed.secret.token ? previous.webhookSecret : randomHex(24)
      const hook = await api.setWebhook(`${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/telegram?org=${caller.orgId}`, webhookSecret).catch(() => null)
      if (!hook?.ok) return json(400, { error: 'webhook' })
      parsed.secret.username = username
      parsed.secret.webhookSecret = webhookSecret
    }
    const { error } = await sb
      .from('integration_secrets')
      .upsert({ organization_id: caller.orgId, provider, secret: parsed.secret, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,provider' })
    if (error) return json(500, { error: 'db' })
    await caller.client.rpc('log_event', { p_action: 'settings.update', p_summary: `${LABELS[provider]}: ulandi` })
    return json(200, { ok: true, status: { configured: true, ...maskSecret(provider, parsed.secret) } })
  }

  if (body.action === 'sms.send' || body.action === 'sms.test') {
    const test = body.action === 'sms.test'
    const allowed = test ? await caller.can('settings.manage') : (await caller.can('payments.create')) || (await caller.can('customers.edit'))
    if (!allowed) return json(403, { error: 'forbidden' })
    const { data: writable } = await caller.client.rpc('org_writable')
    if (!writable) return json(403, { error: 'readonly' })
    const secret = await loadSecret(sb, caller.orgId, 'eskiz')
    if (!isEskizSecret(secret)) return json(400, { error: 'not-configured' })
    const client = smsClient(sb, caller.orgId, secret)

    if (test) {
      const phone = typeof body.phone === 'string' ? body.phone : ''
      const text = typeof body.text === 'string' && body.text.trim() ? body.text.trim().slice(0, 1000) : ESKIZ_TEST_TEXT
      const result = await client.send(phone, text)
      if (result.error !== 'phone') await logSms(sb, caller, { customerId: null, phone: phone.replace(/\D/g, '').slice(-12), text, kind: 'test' }, result)
      return json(result.ok ? 200 : 400, result.ok ? { ok: true, id: result.id } : { error: 'sms', detail: result.error })
    }

    // Telefon raqami mijoz kartasidan olinadi (ilova yuborgan raqamga ishonilmaydi)
    const messages = Array.isArray(body.messages) ? body.messages.filter(isRecord).slice(0, MAX_SMS) : []
    const ids = [...new Set(messages.map((m) => String(m.customerId ?? '')).filter(Boolean))]
    if (ids.length === 0) return json(400, { error: 'messages' })
    const { data: customers } = await sb.from('customers').select('id, name, phone').eq('organization_id', caller.orgId).is('deleted_at', null).in('id', ids)
    const byId = new Map(((customers ?? []) as Array<Record<string, unknown>>).map((c) => [String(c.id), c]))
    const items = messages
      .map((m) => ({ customer: byId.get(String(m.customerId ?? '')), text: typeof m.text === 'string' ? m.text.trim().slice(0, 1000) : '' }))
      .filter((m) => m.customer && m.text)
      .map((m) => ({ customerId: String(m.customer?.id), name: String(m.customer?.name), phone: String(m.customer?.phone ?? ''), text: m.text }))
    const failures: Array<{ customerId: string; error: string }> = []
    const summary = await sendAll(client, items, async (item, result) => {
      const digits = item.phone.replace(/\D/g, '').slice(-12)
      if (digits.length >= 9) await logSms(sb, caller, { customerId: item.customerId, phone: digits, text: item.text, kind: 'reminder' }, result)
      if (result.ok) await caller.client.rpc('log_event', { p_action: 'reminder.sent', p_summary: `${item.name} · SMS`, p_entity: item.customerId })
      else failures.push({ customerId: item.customerId, error: result.error ?? 'error' })
    })
    return json(200, { ok: true, ...summary, failures })
  }

  if (body.action === 'telegram.link' || body.action === 'telegram.send' || body.action === 'telegram.unlink') {
    if (!(await canRemind(caller))) return json(403, { error: 'forbidden' })
    const secret = await loadSecret(sb, caller.orgId, 'telegram')
    if (!isTelegramSecret(secret)) return json(400, { error: 'not-configured' })

    if (body.action === 'telegram.link') {
      const code = await linkCode(secret.webhookSecret, String(body.customerId ?? ''))
      if (!code) return json(400, { error: 'customer' })
      return json(200, { ok: true, link: `https://t.me/${secret.username}?start=${code}` })
    }

    if (body.action === 'telegram.unlink') {
      const { error } = await sb.from('telegram_links').delete().eq('organization_id', caller.orgId).eq('customer_id', String(body.customerId ?? ''))
      return error ? json(500, { error: 'db' }) : json(200, { ok: true })
    }

    // Eslatma ota-onaga bot orqali (bog'lanmaganlar — notLinked)
    const { data: writable } = await caller.client.rpc('org_writable')
    if (!writable) return json(403, { error: 'readonly' })
    const messages = Array.isArray(body.messages) ? body.messages.filter(isRecord).slice(0, MAX_SMS) : []
    const ids = [...new Set(messages.map((m) => String(m.customerId ?? '')).filter(Boolean))]
    const { data: links } = await sb.from('telegram_links').select('customer_id, chat_id, lang').eq('organization_id', caller.orgId).in('customer_id', ids.length ? ids : [''])
    const { data: customers } = await sb.from('customers').select('id, name').eq('organization_id', caller.orgId).in('id', ids.length ? ids : [''])
    const names = new Map(((customers ?? []) as Array<Record<string, unknown>>).map((c) => [String(c.id), String(c.name)]))
    const api = telegramApi(secret.token, fetch)
    let sent = 0
    let failed = 0
    let notLinked = 0
    for (const m of messages) {
      const customerId = String(m.customerId ?? '')
      const text = typeof m.text === 'string' ? m.text.trim().slice(0, 3000) : ''
      const chats = ((links ?? []) as Array<Record<string, unknown>>).filter((l) => String(l.customer_id) === customerId)
      if (!text || chats.length === 0) {
        notLinked += 1
        continue
      }
      let delivered = false
      for (const chat of chats) {
        const result = await api.sendMessage(Number(chat.chat_id), text, null, (chat.lang === 'ru' ? 'ru' : 'uz') as Lang).catch(() => null)
        if (result?.ok) delivered = true
        // Ota-ona botni bloklagan — bog'lanish o'chiriladi
        else if (result?.status === 403) await sb.from('telegram_links').delete().eq('organization_id', caller.orgId).eq('customer_id', customerId).eq('chat_id', Number(chat.chat_id))
      }
      if (delivered) {
        sent += 1
        await caller.client.rpc('log_event', { p_action: 'reminder.sent', p_summary: `${names.get(customerId) ?? customerId} · Telegram bot`, p_entity: customerId })
      } else failed += 1
    }
    return json(200, { ok: true, sent, failed, notLinked })
  }

  return json(400, { error: 'action' })
})
