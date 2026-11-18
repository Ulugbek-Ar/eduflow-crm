// Edge Function "payme": Payme Merchant API endpoint'i. Payme kabinetida endpoint manzili:
//   https://<loyiha>.supabase.co/functions/v1/payme?org=<markaz id>
// JWT tekshiruvi o'chiq (supabase/config.toml) — Payme "Authorization: Basic Paycom:<kalit>" yuboradi, kalit shu yerda tekshiriladi.
// Deploy: supabase functions deploy payme --no-verify-jwt
import { handlePayme, isPaymeConfig } from '../_shared/payme.ts'
import { json, loadSecret, paymentStore, serviceClient, UUID } from '../_shared/supabase.ts'

const plain = { 'Cache-Control': 'no-store' }

Deno.serve(async (req) => {
  const org = new URL(req.url).searchParams.get('org') ?? ''
  const body: unknown = await req.json().catch(() => null)
  const sb = serviceClient()
  const secret = UUID.test(org) && req.method === 'POST' ? await loadSecret(sb, org, 'payme') : null
  const config = isPaymeConfig(secret) ? secret : null
  const response = await handlePayme(body, {
    authorization: req.headers.get('Authorization'),
    config,
    store: paymentStore(sb, org, 'payme', 'Payme'),
    now: Date.now(),
    changeKey: async (key) => {
      if (!config) return
      const { error } = await sb
        .from('integration_secrets')
        .update({ secret: { ...config, key }, updated_at: new Date().toISOString() })
        .eq('organization_id', org)
        .eq('provider', 'payme')
      if (error) throw new Error(error.message)
    },
  })
  // Payme protokoli: xato ham HTTP 200 bilan, JSON-RPC javobida
  return json(200, response, plain)
})
