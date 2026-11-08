// Edge Function "telegram": ota-onalar boti webhook'i. Bot ulanganda (Sozlamalar → Telegram bot) integrations funksiyasi
// setWebhook qiladi: https://<loyiha>.supabase.co/functions/v1/telegram?org=<markaz id>, secret_token bilan.
// Telegram har so'rovda X-Telegram-Bot-Api-Secret-Token sarlavhasini yuboradi — shu yerda tekshiriladi.
// Deploy: supabase functions deploy telegram --no-verify-jwt
import { botStore, isTelegramSecret } from '../_shared/bot.ts'
import { safeEqual } from '../_shared/hash.ts'
import { json, loadSecret, serviceClient, UUID } from '../_shared/supabase.ts'
import { handleUpdate, telegramApi } from '../_shared/telegram.ts'

Deno.serve(async (req) => {
  const org = new URL(req.url).searchParams.get('org') ?? ''
  // Telegram'ga xato qaytarilsa u qayta-qayta yuboradi — tushunarsiz so'rovga ham 200
  if (req.method !== 'POST' || !UUID.test(org)) return json(200, { ok: true })
  const sb = serviceClient()
  const secret = await loadSecret(sb, org, 'telegram')
  if (!isTelegramSecret(secret)) return json(200, { ok: true })
  if (!safeEqual(req.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '', secret.webhookSecret)) return json(401, { error: 'auth' })
  const update: unknown = await req.json().catch(() => null)
  const { data: orgRow } = await sb.from('organizations').select('name, settings').eq('id', org).maybeSingle()
  const replies = await handleUpdate(update, botStore(sb, org, secret, orgRow?.settings ?? {}), String(orgRow?.name ?? 'EduFlow')).catch(() => [])
  const api = telegramApi(secret.token, fetch)
  for (const reply of replies) await api.sendMessage(reply.chatId, reply.text, reply.keyboard, reply.lang)
  return json(200, { ok: true })
})
