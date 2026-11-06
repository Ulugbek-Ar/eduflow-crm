// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { makeCustomer, makeTransaction } from '../test/helpers'
import { cloudConfig } from './config'
import { diffById } from './diff'
import { courseToRow, customerToRow, rowToCourse, rowToCustomer, rowToTransaction, transactionToRow } from './mappers'

describe('bulutli rejim sozlamasi', () => {
  it('kalitlar bo\'lmasa yoki noto\'g\'ri bo\'lsa — lokal rejim', () => {
    expect(cloudConfig({})).toBeNull()
    expect(cloudConfig({ VITE_SUPABASE_URL: 'ftp://x', VITE_SUPABASE_ANON_KEY: 'a'.repeat(40) })).toBeNull()
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: 'short' })).toBeNull()
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: 'a'.repeat(40) })).toEqual({ url: 'https://abc.supabase.co', anonKey: 'a'.repeat(40) })
  })
})

describe('qator <-> model', () => {
  it('mijoz, tranzaksiya va kurs o\'zgarishsiz qaytadi', () => {
    const customer = makeCustomer({ email: 'a@b.uz', paidAt: '2026-10-02T00:00:00.000Z' })
    expect(rowToCustomer(customerToRow(customer, 'org'))).toEqual(customer)
    const bare = makeCustomer()
    expect(rowToCustomer(customerToRow(bare, 'org'))).toEqual(bare)
    const tx = makeTransaction({ source: 'instagram' })
    expect(rowToTransaction(transactionToRow(tx, 'org'))).toEqual(tx)
    const course = { id: 'k1', name: 'IELTS', type: 'course' as const, durationMonths: 6, monthlyPrice: 650_000, activeGroups: 2, status: 'active' as const, createdAt: '2026-01-01T00:00:00.000Z' }
    expect(rowToCourse(courseToRow(course, 'org'))).toEqual(course)
    expect(customerToRow(bare, 'org')).toMatchObject({ organization_id: 'org', email: null, paid_at: null })
  })

  it('Supabase bigint (matn) summasi songa aylanadi', () => {
    expect(rowToTransaction({ ...transactionToRow(makeTransaction(), 'o'), amount: '650000' }).amount).toBe(650_000)
  })
})

describe('farq', () => {
  it('faqat o\'zgargan va olib tashlanganlar', () => {
    const a = makeCustomer({ id: 'a' })
    const b = makeCustomer({ id: 'b' })
    const c = makeCustomer({ id: 'c' })
    const changes = diffById([a, b], [{ ...a, name: 'Yangi' }, c])
    expect(changes.upserts.map((x) => x.id)).toEqual(['a', 'c'])
    expect(changes.removedIds).toEqual(['b'])
    expect(diffById([a], [{ ...a }])).toEqual({ upserts: [], removedIds: [] })
  })
})
