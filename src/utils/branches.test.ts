import { describe, expect, it } from 'vitest'
import type { Branch } from '../types/branch.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { Enrollment, Group } from '../types/group.types'
import { branchStats, defaultBranchId } from './branches'
import { findConflicts } from './groupForm'

const branch = (id: string, name: string, status: Branch['status'] = 'active'): Branch => ({ id, name, address: '', phone: '', status, createdAt: '2026-09-01T00:00:00.000Z' })
const group = (patch: Partial<Group>): Group => ({
  id: 'g1',
  name: 'IELTS',
  courseId: 'k1',
  room: '101',
  days: ['mon', 'wed'],
  startTime: '18:00',
  endTime: '19:30',
  capacity: 12,
  startDate: '2026-09-01',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...patch,
})
const customer = (id: string, branchId?: string): Customer => ({ id, name: id, phone: '', course: '', status: 'paid', source: 'telegram', createdAt: '2026-09-01T00:00:00.000Z', ...(branchId ? { branchId } : {}) })
const enrollment = (id: string, customerId: string, groupId: string, status: Enrollment['status'] = 'active'): Enrollment => ({ id, customerId, groupId, startDate: '2026-09-01', status, createdAt: '2026-09-01T00:00:00.000Z' })
const tx = (patch: Partial<Transaction>): Transaction => ({ id: 't', type: 'income', amount: 100, method: 'cash', category: 'course_fee', note: '', status: 'paid', date: '2026-11-05T10:00:00.000Z', ...patch })

describe('filiallar', () => {
  it('standart filial: cheklangan xodimniki, tanlangani yoki birinchi faol filial', () => {
    const list = [branch('b1', 'Chilonzor', 'archived'), branch('b2', 'Yunusobod')]
    expect(defaultBranchId(list, '', 'b1')).toBe('b1')
    expect(defaultBranchId(list, 'b1')).toBe('b1')
    expect(defaultBranchId(list, '')).toBe('b2')
    expect(defaultBranchId([], '')).toBe('')
  })

  it('taqqoslash: o\'quvchi va guruhlar hozir, kirim/xarajat davr bo\'yicha; filialsiz to\'lovlar — umumiy qator', () => {
    const branches = [branch('b1', 'Chilonzor'), branch('b2', 'Yunusobod'), branch('b3', 'Eski', 'archived')]
    const groups = [group({ id: 'g1', branchId: 'b1' }), group({ id: 'g2', branchId: 'b2' }), group({ id: 'g3', branchId: 'b2', status: 'archived' })]
    const enrollments = [enrollment('e1', 'c1', 'g1'), enrollment('e2', 'c2', 'g2'), enrollment('e3', 'c3', 'g2', 'left'), enrollment('e4', 'gone', 'g1')]
    const customers = [customer('c1', 'b1'), customer('c2'), customer('c3', 'b2')]
    const transactions = [
      tx({ id: 't1', amount: 650_000, branchId: 'b1' }),
      tx({ id: 't2', amount: 500_000, branchId: 'b2' }),
      tx({ id: 't3', type: 'expense', category: 'rent', amount: 2_000_000, branchId: 'b2' }),
      tx({ id: 't4', amount: 999, branchId: 'b1', status: 'pending' }),
      tx({ id: 't5', amount: 1_000, branchId: 'b1', date: '2026-08-01T10:00:00.000Z' }),
      tx({ id: 't6', type: 'expense', category: 'marketing', amount: 300_000 }),
    ]
    const period = { start: new Date('2026-11-01T00:00:00'), end: new Date('2026-11-30T23:59:59') }
    const rows = branchStats(branches, { customers, groups, enrollments, transactions }, period)
    expect(rows.map((r) => [r.branch?.id ?? null, r.students, r.groups, r.income, r.expense, r.profit])).toEqual([
      ['b1', 1, 1, 650_000, 0, 650_000],
      ['b2', 1, 1, 500_000, 2_000_000, -1_500_000],
      [null, 0, 0, 0, 300_000, -300_000],
    ])
  })

  it('xona ziddiyati — faqat bir filial ichida; o\'qituvchi — butun markaz bo\'yicha', () => {
    const existing = [group({ id: 'g1', branchId: 'b1', teacherId: 'p1' })]
    expect(findConflicts({ ...group({ id: 'new' }), branchId: 'b2' }, existing)).toEqual([])
    expect(findConflicts({ ...group({ id: 'new' }), branchId: 'b1' }, existing).map((c) => c.kind)).toEqual(['room'])
    expect(findConflicts({ ...group({ id: 'new', room: '202', teacherId: 'p1' }), branchId: 'b2' }, existing).map((c) => c.kind)).toEqual(['teacher'])
  })
})
