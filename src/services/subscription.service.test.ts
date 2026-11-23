// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { computeAccess, createTrial, loadSubscription, saveSubscription, startTrialIfMissing } from './subscription.service'

const DAY = 86_400_000
beforeEach(() => localStorage.clear())

describe('tarif va sinov', () => {
  it('yangi markaz — 14 kunlik sinov, 3 xodim', () => {
    const now = Date.parse('2026-11-06T10:00:00Z')
    startTrialIfMissing(new Date(now))
    const access = computeAccess(loadSubscription(), now)
    expect(access).toMatchObject({ state: 'trial', daysLeft: 14, readOnly: false, staffLimit: 3 })
  })

  it('avvalgi versiyadan kelgan markaz — Standart, muddatsiz', () => {
    expect(loadSubscription()).toMatchObject({ plan: 'standard', enforced: false })
    expect(computeAccess(loadSubscription())).toMatchObject({ state: 'active', daysLeft: null, staffLimit: 5 })
  })

  it('oxirgi 5 kun — ogohlantirish; tugagach: lokalda ishlaydi, majburiy rejimda faqat ko\'rish', () => {
    const start = Date.parse('2026-11-01T00:00:00Z')
    const trial = createTrial(new Date(start))
    expect(computeAccess(trial, start + 10 * DAY).state).toBe('expiring')
    expect(computeAccess(trial, start + 15 * DAY)).toMatchObject({ state: 'expired', readOnly: false })
    expect(computeAccess({ ...trial, enforced: true }, start + 15 * DAY).readOnly).toBe(true)
    expect(computeAccess({ ...trial, status: 'blocked', enforced: true }, start).state).toBe('blocked')
  })

  it('Pro — xodim cheksiz; buzuq yozuv e\'tiborsiz', () => {
    saveSubscription({ plan: 'pro', status: 'active', paidUntil: new Date(Date.now() + 40 * DAY).toISOString(), enforced: false })
    expect(computeAccess(loadSubscription()).staffLimit).toBeNull()
    localStorage.setItem('apex:subscription', '{"plan":"gold"}')
    expect(loadSubscription().plan).toBe('standard')
  })
})
