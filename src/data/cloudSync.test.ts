// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { makeCustomer, makeTransaction } from '../test/helpers'
import { CloudSync, logEvent, setClient } from './supabase'

type Call = { op: string; table?: string; args?: unknown }

function fakeClient(calls: Call[]) {
  const ok = Promise.resolve({ error: null, data: null })
  const chain = (table: string) => {
    const builder = {
      upsert: (rows: unknown, opts: unknown) => {
        calls.push({ op: 'upsert', table, args: { rows, opts } })
        return ok
      },
      delete: () => ({
        eq: (_col: string, org: string) => ({
          in: (_c: string, ids: string[]) => {
            calls.push({ op: 'delete', table, args: { org, ids } })
            return ok
          },
        }),
      }),
    }
    return builder
  }
  return {
    from: chain,
    rpc: (name: string, args: unknown) => {
      calls.push({ op: 'rpc', table: name, args })
      return ok
    },
  } as unknown as SupabaseClient
}

afterEach(() => setClient(null))

describe('Bulut bilan sinxronlash', () => {
  it('faqat farq yuboriladi: yangi/o\'zgargan — upsert, olib tashlangan — savatchaga', async () => {
    const calls: Call[] = []
    setClient(fakeClient(calls))
    const sync = new CloudSync('org-1', [])
    const a = makeCustomer({ id: 'a' })
    const b = makeCustomer({ id: 'b' })
    await sync.customers([a, b], [{ ...a, status: 'new' }])
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({ op: 'upsert', table: 'customers', args: { opts: { onConflict: 'organization_id,id' } } })
    expect((calls[0].args as { rows: Array<{ id: string; organization_id: string; status: string }> }).rows).toMatchObject([{ id: 'a', organization_id: 'org-1', status: 'new' }])
    expect(calls[1]).toEqual({ op: 'rpc', table: 'trash_move', args: { p_table: 'customers', p_ids: ['b'] } })

    // O'zgarish bo'lmasa — hech narsa yuborilmaydi
    calls.length = 0
    await sync.customers([a], [a])
    expect(calls).toEqual([])
  })

  it('savatchadagi yozuv qaytsa — upsert va trash_restore', async () => {
    const calls: Call[] = []
    setClient(fakeClient(calls))
    const tx = makeTransaction({ id: 't9' })
    const sync = new CloudSync('org-1', [{ kind: 'transaction', id: 't9', deletedAt: new Date().toISOString(), deletedBy: 'X', item: tx }])
    await sync.transactions([], [tx])
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual(['upsert:transactions', 'rpc:trash_restore'])
    // Ikkinchi marta — oddiy upsert (endi savatchada emas)
    calls.length = 0
    await sync.transactions([], [{ ...tx, amount: 1 }])
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual(['upsert:transactions'])
  })

  it('v11: guruh va o\'qish savatcha bilan, davomat — noyob kalit bo\'yicha upsert va o\'chirish', async () => {
    const calls: Call[] = []
    setClient(fakeClient(calls))
    const sync = new CloudSync('org-1', [])
    const group = { id: 'g1', name: 'IELTS', courseId: 'k1', room: '', days: ['mon' as const], startTime: '09:00', endTime: '10:30', capacity: 12, startDate: '2026-09-01', status: 'active' as const, createdAt: '2026-09-01T00:00:00.000Z' }
    await sync.list('groups', [group], [])
    expect(calls).toEqual([{ op: 'rpc', table: 'trash_move', args: { p_table: 'groups', p_ids: ['g1'] } }])
    calls.length = 0
    const enrollment = { id: 'e1', customerId: 'c1', groupId: 'g1', startDate: '2026-09-01', status: 'active' as const, createdAt: '2026-09-01T00:00:00.000Z' }
    await sync.list('enrollments', [], [enrollment])
    expect(calls[0]).toMatchObject({ op: 'upsert', table: 'enrollments', args: { opts: { onConflict: 'organization_id,id' } } })
    calls.length = 0
    const mark = { id: 'd1', groupId: 'g1', customerId: 'c1', date: '2026-11-06', status: 'present' as const, updatedAt: '2026-11-06T10:00:00.000Z' }
    await sync.list('attendance', [mark], [{ ...mark, status: 'absent' }])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ op: 'upsert', table: 'attendance', args: { opts: { onConflict: 'organization_id,group_id,customer_id,date' } } })
    calls.length = 0
    await sync.list('attendance', [mark], [])
    expect(calls).toEqual([{ op: 'delete', table: 'attendance', args: { org: 'org-1', ids: ['d1'] } }])
    calls.length = 0
    await sync.list('lessonExceptions', [], [{ id: 'x1', groupId: 'g1', date: '2026-10-01', reason: 'Bayram' }])
    expect(calls[0]).toMatchObject({ op: 'upsert', table: 'lesson_exceptions', args: { opts: { onConflict: 'organization_id,group_id,date' } } })
  })

  it('savatchadan butunlay o\'chirish faqat shu markaz qatorlari', async () => {
    const calls: Call[] = []
    setClient(fakeClient(calls))
    await new CloudSync('org-7', []).purge('course', ['k1', 'k2'])
    expect(calls).toEqual([{ op: 'delete', table: 'courses', args: { org: 'org-7', ids: ['k1', 'k2'] } }])
  })

  it('jurnal: ma\'lumot o\'zgarishlari serverda yoziladi, ilova faqat kirish/eksport hodisalarini yuboradi', async () => {
    const calls: Call[] = []
    setClient(fakeClient(calls))
    await logEvent('customer.create', 'Aziza')
    await logEvent('data.export', 'Mijozlar — Excel')
    expect(calls).toEqual([{ op: 'rpc', table: 'log_event', args: { p_action: 'data.export', p_summary: 'Mijozlar — Excel', p_entity: null } }])
  })
})
