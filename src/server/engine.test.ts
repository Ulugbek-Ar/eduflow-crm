import { describe, expect, it } from 'vitest'
import { courseToRow, customerToRow, enrollmentToRow, groupToRow, transactionToRow } from '../data/mappers'
import { generateDemo } from '../services/demo/generator'
import { computeDebts, DEFAULT_DEBT_SETTINGS } from '../utils/debts'
import { debtorReminders, tashkentNow } from './engine'
import type { OrgRows } from './engine'

const ORG = '11111111-2222-3333-4444-555555555555'

// Demo markaz -> bazadagi qatorlar ko'rinishi (Edge Function shunday o'qiydi)
function demoRows(now: Date): { rows: OrgRows; demo: ReturnType<typeof generateDemo> } {
  const demo = generateDemo(now)
  const rows: OrgRows = {
    settings: { orgName: 'EduFlow Academy', paymentDueDay: 10, prorateFirstMonth: false },
    customers: demo.customers.map((c) => customerToRow(c, ORG)),
    courses: demo.courses.map((c) => courseToRow(c, ORG)),
    transactions: demo.transactions.map((t) => transactionToRow(t, ORG)),
    groups: demo.groups.map((g) => groupToRow(g, ORG)),
    enrollments: demo.enrollments.map((e) => enrollmentToRow(e, ORG)),
  }
  return { rows, demo }
}

describe('server hisobi (engine)', () => {
  it('qarzdorlar ilovadagi hisob bilan aynan bir xil; eslatma matni shablon bo\'yicha', () => {
    const now = new Date('2026-11-20T09:00:00')
    const { rows, demo } = demoRows(now)
    const expected = computeDebts(demo.customers, demo.courses, demo.transactions, now, { groups: demo.groups, enrollments: demo.enrollments, settings: DEFAULT_DEBT_SETTINGS })
    const result = debtorReminders(rows, { now, lang: 'uz', withLink: false })
    expect(result.map((r) => [r.customerId, r.debt])).toEqual(expected.map((r) => [r.customer.id, r.debt]))
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].text).toContain(`Assalomu alaykum, ${result[0].name}!`)
    expect(result[0].text).toContain('noyabr oyi to\'lovi')
    const ru = debtorReminders(rows, { now, lang: 'ru', withLink: false })
    expect(ru[0].text).toContain(`Здравствуйте, ${ru[0].name}!`)
    expect(ru[0].text).toContain('сум')
  })

  it('savatchadagi mijoz va uning o\'qishi hisobga kirmaydi; onlayn to\'lov ulangan bo\'lsa — havola', () => {
    const now = new Date('2026-11-20T09:00:00')
    const { rows } = demoRows(now)
    const [first] = debtorReminders(rows, { now, lang: 'uz', withLink: true })
    const trashed: OrgRows = { ...rows, customers: rows.customers.map((r) => (r.id === first.customerId ? { ...r, deleted_at: now.toISOString() } : r)) }
    expect(debtorReminders(trashed, { now, lang: 'uz', withLink: true }).some((r) => r.customerId === first.customerId)).toBe(false)
    expect(first.text).not.toContain('checkout.paycom.uz')
    const withPayme: OrgRows = { ...rows, settings: { ...(rows.settings as object), paymeMerchantId: '5e730e8e0b852a417aa49ceb' } }
    expect(debtorReminders(withPayme, { now, lang: 'uz', withLink: true })[0].text).toMatch(/To'lov havolasi: https:\/\/checkout\.paycom\.uz\//)
  })

  it('Toshkent vaqti: UTC + 5 soat', () => {
    expect(tashkentNow(Date.UTC(2026, 10, 30, 20, 0)).getUTCDate()).toBe(1)
  })

  it('yig\'ma (generated/engine.js) manbadagi bilan bir xil ishlaydi va eksportlar .d.ts bilan mos', async () => {
    const bundle = (await import('../../supabase/functions/_shared/generated/engine.js')) as Record<string, unknown>
    expect(Object.keys(bundle).sort()).toEqual(['debtorReminders', 'tashkentNow'])
    const now = new Date('2026-11-20T09:00:00')
    const { rows } = demoRows(now)
    const fromBundle = (bundle.debtorReminders as typeof debtorReminders)(rows, { now, lang: 'uz', withLink: false })
    expect(fromBundle).toEqual(debtorReminders(rows, { now, lang: 'uz', withLink: false }))
  })
})
