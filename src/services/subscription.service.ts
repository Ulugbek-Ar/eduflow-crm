// Markaz tarifi va sinov muddati. Lokal rejimda faqat ko'rsatiladi (brauzerdagi cheklovni chetlab o'tish mumkin);
// bulutli (Supabase) rejimda server qiymati — majburiy: muddat tugasa yoki bloklansa, panel faqat ko'rish rejimida
import { PLANS, TRIAL_DAYS } from '../constants/plans'
import type { PlanId } from '../constants/plans'
import { isIsoDate, isRecord, oneOf } from '../utils/guards'
import { readJson, setItem } from './storage.service'

export const SUBSCRIPTION_KEY = 'apex:subscription'
const DAY = 86_400_000
// Shuncha kun qolganda ogohlantirish chiqadi
export const WARN_DAYS = 5

export interface Subscription {
  plan: PlanId
  status: 'active' | 'blocked'
  trialEndsAt?: string
  paidUntil?: string
  // true — server qiymati (Supabase), cheklovlar majburiy
  enforced: boolean
}

export type AccessState = 'trial' | 'active' | 'expiring' | 'expired' | 'blocked'

export interface Access {
  state: AccessState
  // Muddat tugashiga qolgan kun (cheksiz bo'lsa null)
  daysLeft: number | null
  // Yozish taqiqlangan (faqat majburiy rejimda)
  readOnly: boolean
  staffLimit: number | null
  branchLimit: number | null
}

const PLAN_IDS: Record<PlanId, true> = { trial: true, standard: true, pro: true }

export function isSubscription(value: unknown): value is Subscription {
  return (
    isRecord(value) &&
    oneOf(PLAN_IDS, value.plan) &&
    (value.status === 'active' || value.status === 'blocked') &&
    (value.trialEndsAt === undefined || isIsoDate(value.trialEndsAt)) &&
    (value.paidUntil === undefined || isIsoDate(value.paidUntil)) &&
    typeof value.enforced === 'boolean'
  )
}

export function createTrial(now = new Date()): Subscription {
  return { plan: 'trial', status: 'active', trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY).toISOString(), enforced: false }
}

// Yozuv bo'lmasa: mavjud (avvalgi versiyadan kelgan) markaz — Standart, muddatsiz; ishi to'xtamaydi
export function loadSubscription(): Subscription {
  const raw = readJson(SUBSCRIPTION_KEY)
  return isSubscription(raw) ? raw : { plan: 'standard', status: 'active', enforced: false }
}

export function saveSubscription(sub: Subscription): void {
  setItem(SUBSCRIPTION_KEY, sub)
}

export function startTrialIfMissing(now = new Date()): void {
  if (!isSubscription(readJson(SUBSCRIPTION_KEY))) saveSubscription(createTrial(now))
}

export function planOf(id: PlanId) {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}

export function computeAccess(sub: Subscription, now = Date.now()): Access {
  const { staffLimit, branchLimit } = planOf(sub.plan)
  const end = sub.plan === 'trial' ? sub.trialEndsAt : sub.paidUntil
  const daysLeft = end ? Math.ceil((Date.parse(end) - now) / DAY) : null
  let state: AccessState
  if (sub.status === 'blocked') state = 'blocked'
  else if (daysLeft !== null && daysLeft <= 0) state = 'expired'
  else if (daysLeft !== null && daysLeft <= WARN_DAYS) state = 'expiring'
  else state = sub.plan === 'trial' ? 'trial' : 'active'
  return { state, daysLeft, readOnly: sub.enforced && (state === 'blocked' || state === 'expired'), staffLimit, branchLimit }
}
