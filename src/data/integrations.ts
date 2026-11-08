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
