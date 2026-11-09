// Bulutli rejim: "integrations" Edge Function'i (kalitlar faqat serverda saqlanadi, ilovaga holat qaytadi)
import { isRecord } from '../utils/guards'
import { cloudConfig } from './config'
import { getClient } from './supabase'

export type IntegrationProvider = 'payme' | 'click' | 'eskiz' | 'telegram'

export type ProviderStatus = { configured: boolean; updatedAt?: string } & Record<string, unknown>

export type IntegrationResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; field?: string }

export async function callIntegrations(body: Record<string, unknown>): Promise<IntegrationResult> {
  try {
    const { data, error } = await getClient().functions.invoke('integrations', { body })
    if (!error) return { ok: true, data: isRecord(data) ? data : {} }
    // Server xato javobi (400/403): { error, field }
    const context: unknown = (error as { context?: unknown }).context
    const payload: unknown = context instanceof Response ? await context.json().catch(() => null) : null
    if (isRecord(payload) && typeof payload.error === 'string') {
      return { ok: false, error: payload.error, ...(typeof payload.field === 'string' ? { field: payload.field } : {}) }
    }
    return { ok: false, error: 'network' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function integrationStatus(): Promise<Record<string, ProviderStatus> | null> {
  const result = await callIntegrations({ action: 'status' })
  if (!result.ok || !isRecord(result.data.status)) return null
  const status: Record<string, ProviderStatus> = {}
  for (const [key, value] of Object.entries(result.data.status)) if (isRecord(value)) status[key] = { ...value, configured: value.configured === true }
  return status
}

// Webhook manzili (Payme / Click kabinetiga kiritiladi)
export function functionUrl(name: string, orgId: string): string {
  return `${cloudConfig()?.url ?? ''}/functions/v1/${name}?org=${orgId}`
}

export interface SmsLogEntry {
  id: number
  customerId: string | null
  phone: string
  text: string
  kind: 'reminder' | 'auto' | 'test'
  status: 'sent' | 'failed'
  error: string | null
  createdAt: string
}

// SMS jurnali (RLS: o'z markazi, payments.view) — oxirgi yozuvlar
export async function recentSms(limit = 20): Promise<SmsLogEntry[] | null> {
  try {
    const { data, error } = await getClient()
      .from('sms_log')
      .select('id, customer_id, phone, text, kind, status, error, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return null
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      customerId: typeof r.customer_id === 'string' ? r.customer_id : null,
      phone: String(r.phone ?? ''),
      text: String(r.text ?? ''),
      kind: r.kind === 'auto' || r.kind === 'test' ? r.kind : 'reminder',
      status: r.status === 'failed' ? 'failed' : 'sent',
      error: typeof r.error === 'string' ? r.error : null,
      createdAt: String(r.created_at ?? ''),
    }))
  } catch {
    return null
  }
}

// Ota-onalar boti: o'quvchiga nechta ota-ona chati bog'langan (RLS: o'z markazi, customers.view)
export async function telegramLinkCount(customerId: string): Promise<number | null> {
  try {
    const { count, error } = await getClient().from('telegram_links').select('chat_id', { count: 'exact', head: true }).eq('customer_id', customerId)
    return error ? null : (count ?? 0)
  } catch {
    return null
  }
}
