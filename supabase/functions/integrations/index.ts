// Edge Function "integrations": administrator to'lov tizimlari va xabar xizmatlarini ulaydi.
// Kalitlar faqat serverda saqlanadi (integration_secrets); ilovaga faqat holat va oxirgi 4 belgi qaytadi.
// Chaqirish: supabase.functions.invoke('integrations', { body: { action: 'status' | 'save' | 'remove', provider, secret } })
// Deploy: supabase functions deploy integrations
import { isIntegrationProvider, maskSecret, parseSecret } from '../_shared/integrations.ts'
import type { IntegrationProvider } from '../_shared/integrations.ts'
import { isRecord } from '../_shared/payments.ts'
import { callerFromRequest, cors, json, loadSecret, serviceClient } from '../_shared/supabase.ts'

const LABELS: Record<IntegrationProvider, string> = { payme: 'Payme', click: 'Click', eskiz: 'Eskiz SMS', telegram: 'Telegram bot' }
// Shu bosqichda ulanadiganlar (Eskiz va Telegram — keyingi bosqichlarda o'z tekshiruvi bilan)
const SAVABLE: readonly IntegrationProvider[] = ['payme', 'click']

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
      const { error } = await sb.from('integration_secrets').delete().eq('organization_id', caller.orgId).eq('provider', provider)
      if (error) return json(500, { error: 'db' })
      await caller.client.rpc('log_event', { p_action: 'settings.update', p_summary: `${LABELS[provider]}: o'chirildi` })
      return json(200, { ok: true })
    }

    if (!SAVABLE.includes(provider)) return json(400, { error: 'provider' })
    const previous = (await loadSecret(sb, caller.orgId, provider)) ?? {}
    const parsed = parseSecret(provider, body.secret, previous)
    if (!parsed.ok) return json(400, { error: 'invalid', field: parsed.field })
    const { error } = await sb
      .from('integration_secrets')
      .upsert({ organization_id: caller.orgId, provider, secret: parsed.secret, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,provider' })
    if (error) return json(500, { error: 'db' })
    await caller.client.rpc('log_event', { p_action: 'settings.update', p_summary: `${LABELS[provider]}: ulandi` })
    return json(200, { ok: true, status: { configured: true, ...maskSecret(provider, parsed.secret) } })
  }

  return json(400, { error: 'action' })
})
