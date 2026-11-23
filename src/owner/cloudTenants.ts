// Sotuvchi paneli — Supabase ombori (owner_list_orgs / owner_update_org RPC, faqat platform_admins)
import { getClient } from '../data/supabase'
import type { Tenant, TenantsRepository } from './tenants'

type OrgRow = {
  id: string
  name: string
  plan: Tenant['plan']
  status: Tenant['status']
  trial_ends_at: string | null
  paid_until: string | null
  created_at: string
  staff_count: number
  customer_count: number
  contact: string
  city: string
  last_active_at: string
}

function toTenant(r: OrgRow): Tenant {
  return {
    id: r.id,
    name: r.name,
    city: r.city,
    contact: r.contact,
    plan: r.plan,
    status: r.status,
    ...(r.trial_ends_at ? { trialEndsAt: r.trial_ends_at } : {}),
    ...(r.paid_until ? { paidUntil: r.paid_until } : {}),
    staffCount: Number(r.staff_count),
    customerCount: Number(r.customer_count),
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at,
  }
}

export function cloudTenantsRepository(): TenantsRepository {
  const list = async () => {
    const { data, error } = await getClient().rpc('owner_list_orgs')
    if (error) throw new Error(error.message)
    return ((data ?? []) as OrgRow[]).map(toTenant)
  }
  return {
    kind: 'supabase',
    list,
    update: async (id, patch) => {
      const { error } = await getClient().rpc('owner_update_org', {
        p_id: id,
        p_plan: patch.plan ?? null,
        p_status: patch.status ?? null,
        p_trial_ends_at: patch.trialEndsAt ?? null,
        p_paid_until: patch.paidUntil ?? null,
      })
      if (error) throw new Error(error.message)
      const updated = (await list()).find((t) => t.id === id)
      if (!updated) throw new Error('Markaz topilmadi')
      return updated
    },
  }
}

// Sotuvchi Supabase'ga email/parol bilan kiradi; platform_admins jadvalida bo'lishi shart
export async function ownerSignIn(email: string, password: string): Promise<'ok' | 'invalid' | 'not-owner'> {
  const sb = getClient()
  const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) return 'invalid'
  const { data } = await sb.rpc('is_platform_admin')
  if (!data) {
    await sb.auth.signOut()
    return 'not-owner'
  }
  return 'ok'
}
