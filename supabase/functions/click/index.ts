// Edge Function "click": Click SHOP API (Prepare va Complete bitta manzilda). Click kabinetida:
//   https://<loyiha>.supabase.co/functions/v1/click?org=<markaz id>
// JWT tekshiruvi o'chiq (supabase/config.toml) — so'rov MD5 imzo (sign_string) bilan tekshiriladi.
// Deploy: supabase functions deploy click --no-verify-jwt
import { handleClick, isClickConfig } from '../_shared/click.ts'
import { json, loadSecret, paymentStore, serviceClient, UUID } from '../_shared/supabase.ts'

const plain = { 'Cache-Control': 'no-store' }

Deno.serve(async (req) => {
  const org = new URL(req.url).searchParams.get('org') ?? ''
  const form = new URLSearchParams(req.method === 'POST' ? await req.text().catch(() => '') : '')
  const params: Record<string, string> = {}
  for (const [key, value] of form) params[key] = value
  const sb = serviceClient()
  const secret = UUID.test(org) && req.method === 'POST' ? await loadSecret(sb, org, 'click') : null
  const response = await handleClick(params, {
    config: isClickConfig(secret) ? secret : null,
    store: paymentStore(sb, org, 'click', 'Click'),
    now: Date.now(),
  })
  return json(200, response, plain)
})
