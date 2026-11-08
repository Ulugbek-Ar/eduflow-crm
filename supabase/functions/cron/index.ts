// Edge Function "cron": kunlik avtomatik qarz eslatmalari (SMS, Eskiz). pg_cron + pg_net chaqiradi (DEPLOY.md §7):
//   POST https://<loyiha>.supabase.co/functions/v1/cron  sarlavha: x-cron-secret: <CRON_SECRET>
// Har markaz uchun: Eskiz ulangan, Sozlamalarda "Avtomatik eslatma" yoqilgan, tarifi faol bo'lsa — qarzdorlarga
// (oxirgi N kunda SMS olmaganlariga) shablon bo'yicha xabar, onlayn to'lov ulangan bo'lsa havola bilan.
// Qarz ilova bilan aynan bir xil hisoblanadi (generated/engine.js — src/server/engine.ts yig'masi).
// Deploy: supabase functions deploy cron --no-verify-jwt ; supabase secrets set CRON_SECRET=<uzun tasodifiy satr>
// @ts-types="../_shared/generated/engine.d.ts"
import { debtorReminders, tashkentNow } from '../_shared/generated/engine.js'
import { eskizClient, isEskizSecret, sendAll } from '../_shared/eskiz.ts'
import { safeEqual } from '../_shared/hash.ts'
import { isRecord } from '../_shared/payments.ts'
import { json, serviceClient } from '../_shared/supabase.ts'
import type { SupabaseClient } from '../_shared/supabase.ts'

type Row = Record<string, unknown>
const MAX_PER_ORG = 300

function orgActive(o: Row, now: number): boolean {
  if (o.status !== 'active') return false
  const until = o.plan === 'trial' ? o.trial_ends_at : o.paid_until
  return until === null || until === undefined || Date.parse(String(until)) > now
}

async function rows(sb: SupabaseClient, table: string, org: string): Promise<Row[]> {
  const { data, error } = await sb.from(table).select('*').eq('organization_id', org).limit(50_000)
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []) as Row[]
}

async function remindOrg(sb: SupabaseClient, org: Row, secret: unknown, now: number) {
  const id = String(org.id)
  const settings = isRecord(org.settings) ? org.settings : {}
  if (settings.autoReminders !== true || !isEskizSecret(secret)) return null
  const everyDays = Math.min(30, Math.max(3, Math.round(Number(settings.autoRemindEveryDays) || 7)))
  const lang = settings.autoRemindLang === 'ru' ? 'ru' : 'uz'
  const [customers, courses, transactions, groups, enrollments] = await Promise.all(
    ['customers', 'courses', 'transactions', 'groups', 'enrollments'].map((table) => rows(sb, table, id)),
  )
  const debtors = debtorReminders({ settings, customers, courses, transactions, groups, enrollments }, { now: tashkentNow(now), lang, withLink: true })
  // Shu davrda SMS olganlar (avtomatik yoki eslatma oynasidan) qayta olmaydi
  const since = new Date(now - everyDays * 86_400_000).toISOString()
  const { data: recent } = await sb.from('sms_log').select('customer_id').eq('organization_id', id).eq('status', 'sent').gte('created_at', since)
  const reminded = new Set(((recent ?? []) as Row[]).map((r) => String(r.customer_id)))
  const targets = debtors.filter((d) => !reminded.has(d.customerId)).slice(0, MAX_PER_ORG)
  const client = eskizClient(secret, fetch, now, async (token, at) => {
    await sb.from('integration_secrets').update({ secret: { ...secret, token, tokenAt: at } }).eq('organization_id', id).eq('provider', 'eskiz')
  })
  const summary = await sendAll(client, targets, async (item, result) => {
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
    if (result.ok) {
      await sb.from('audit_log').insert({ organization_id: id, user_name: 'Avtomatik eslatma', action: 'reminder.sent', summary: `${item.name} · SMS`.slice(0, 200), entity_id: item.customerId })
    }
  })
  return { org: id, debtors: debtors.length, ...summary }
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET') ?? ''
  if (!expected || !safeEqual(req.headers.get('x-cron-secret') ?? '', expected)) return json(401, { error: 'auth' })
  const sb = serviceClient()
  const now = Date.now()
  const { data: secrets, error } = await sb.from('integration_secrets').select('organization_id, secret').eq('provider', 'eskiz')
  if (error) return json(500, { error: 'db' })
  const report: unknown[] = []
  for (const s of (secrets ?? []) as Row[]) {
    const { data: org } = await sb.from('organizations').select('id, status, plan, trial_ends_at, paid_until, settings').eq('id', String(s.organization_id)).maybeSingle()
    if (!org || !orgActive(org as Row, now)) continue
    try {
      const result = await remindOrg(sb, org as Row, s.secret, now)
      if (result) report.push(result)
    } catch (e) {
      report.push({ org: String(s.organization_id), error: e instanceof Error ? e.message : 'error' })
    }
  }
  return json(200, { ok: true, report })
})
