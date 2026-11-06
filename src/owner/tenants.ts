// Sotuvchi (super-admin) paneli: markazlar ro'yxati. Lokal/demo rejimda namunaviy ma'lumot (eduflow-owner:tenants);
// Supabase rejimida organizations jadvali (faqat platform_admins jadvalidagi foydalanuvchilarga — RLS)
import type { PlanId } from '../constants/plans'
import { PLANS } from '../constants/plans'
import { isIsoDate, isRecord, isText, keepValid, oneOf } from '../utils/guards'

export const OWNER_TENANTS_KEY = 'eduflow-owner:tenants'
const DAY = 86_400_000

export type TenantStatus = 'active' | 'blocked'

export interface Tenant {
  id: string
  name: string
  city: string
  contact: string
  plan: PlanId
  status: TenantStatus
  trialEndsAt?: string
  paidUntil?: string
  staffCount: number
  customerCount: number
  createdAt: string
  lastActiveAt: string
}

export type TenantPatch = Partial<Pick<Tenant, 'plan' | 'status' | 'trialEndsAt' | 'paidUntil'>>

export interface TenantsRepository {
  readonly kind: 'demo' | 'supabase'
  list(): Promise<Tenant[]>
  update(id: string, patch: TenantPatch): Promise<Tenant>
}

const PLAN_IDS = { trial: true, standard: true, pro: true } as const

function isTenant(v: unknown): v is Tenant {
  return (
    isRecord(v) &&
    isText(v.id) &&
    isText(v.name) &&
    typeof v.city === 'string' &&
    typeof v.contact === 'string' &&
    oneOf(PLAN_IDS, v.plan) &&
    (v.status === 'active' || v.status === 'blocked') &&
    Number.isInteger(v.staffCount) &&
    Number.isInteger(v.customerCount) &&
    isIsoDate(v.createdAt) &&
    isIsoDate(v.lastActiveAt)
  )
}

export function sampleTenants(now = Date.now()): Tenant[] {
  const iso = (days: number) => new Date(now + days * DAY).toISOString()
  const rows: Array<[string, string, string, PlanId, TenantStatus, number | null, number, number, number]> = [
    // nom, shahar, aloqa, tarif, holat, muddat (kun), xodim, mijoz, yaratilgan (kun oldin)
    ['Bilim Plus', 'Toshkent', '+998 90 111 22 33', 'pro', 'active', 41, 9, 412, 210],
    ['Zukko Akademiya', 'Samarqand', '+998 91 222 33 44', 'standard', 'active', 18, 4, 186, 120],
    ['English Hub', 'Toshkent', '+998 93 333 44 55', 'standard', 'active', 3, 5, 240, 95],
    ['IT Park Kids', 'Namangan', '+998 94 444 55 66', 'trial', 'active', 9, 2, 37, 5],
    ['Matematika markazi', 'Buxoro', '+998 95 555 66 77', 'trial', 'active', 2, 3, 58, 12],
    ['Lingvo Star', 'Andijon', '+998 97 666 77 88', 'standard', 'active', -4, 3, 133, 160],
    ['Abituriyent 2027', 'Farg\'ona', '+998 99 777 88 99', 'trial', 'active', -6, 1, 21, 20],
    ['Koreys tili maktabi', 'Toshkent', '+998 88 888 99 00', 'standard', 'blocked', -30, 2, 64, 300],
  ]
  return rows.map(([name, city, contact, plan, status, days, staff, customers, age], i) => ({
    id: `org-${i + 1}`,
    name,
    city,
    contact,
    plan,
    status,
    ...(days === null ? {} : plan === 'trial' ? { trialEndsAt: iso(days) } : { paidUntil: iso(days) }),
    staffCount: staff,
    customerCount: customers,
    createdAt: iso(-age),
    lastActiveAt: iso(-(i % 4)),
  }))
}

// Lokal (demo) ombor: brauzerda; birinchi ochilganda namunaviy markazlar yoziladi
export function localTenantsRepository(storage: Storage = localStorage): TenantsRepository {
  const read = (): Tenant[] => {
    try {
      const raw = JSON.parse(storage.getItem(OWNER_TENANTS_KEY) ?? 'null') as unknown
      if (Array.isArray(raw)) return keepValid(raw, isTenant)
    } catch {
      // buzuq — qaytadan
    }
    const seed = sampleTenants()
    storage.setItem(OWNER_TENANTS_KEY, JSON.stringify(seed))
    return seed
  }
  return {
    kind: 'demo',
    list: async () => read(),
    update: async (id, patch) => {
      const list = read()
      const target = list.find((t) => t.id === id)
      if (!target) throw new Error('Markaz topilmadi')
      const next = { ...target, ...patch }
      storage.setItem(OWNER_TENANTS_KEY, JSON.stringify(list.map((t) => (t.id === id ? next : t))))
      return next
    },
  }
}

export function tenantEnd(t: Tenant): string | undefined {
  return t.plan === 'trial' ? t.trialEndsAt : t.paidUntil
}

export function tenantDaysLeft(t: Tenant, now = Date.now()): number | null {
  const end = tenantEnd(t)
  return end ? Math.ceil((Date.parse(end) - now) / DAY) : null
}

// Oylik tushum: to'lovli tarifdagi, bloklanmagan va muddati o'tmagan markazlar
export function monthlyRevenue(tenants: readonly Tenant[], now = Date.now()): number {
  return tenants
    .filter((t) => t.status === 'active' && t.plan !== 'trial' && (tenantDaysLeft(t, now) ?? 1) > 0)
    .reduce((sum, t) => sum + (PLANS.find((p) => p.id === t.plan)?.priceMonthly ?? 0), 0)
}

// Muddatni uzaytirish: hozirgi tugash sanasidan (o'tib ketgan bo'lsa — bugundan) +N kun
export function extendPatch(t: Tenant, days: number, now = Date.now()): TenantPatch {
  const end = tenantEnd(t)
  const from = Math.max(now, end ? Date.parse(end) : now)
  const next = new Date(from + days * DAY).toISOString()
  return t.plan === 'trial' ? { trialEndsAt: next } : { paidUntil: next }
}
