// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createMockData } from '../services/demo/data'
import { createBackup, normalizeData, parseBackup, SCHEMA_VERSION } from '../services/storage.service'
import { makeCustomer, makeTransaction } from '../test/helpers'
import type { Branch } from '../types/branch.types'
import { isBranch } from '../utils/guards'
import { branchToRow, customerToRow, groupToRow, rowToBranch, rowToCustomer, rowToGroup, rowToTransaction, transactionToRow } from './mappers'

const ORG = '11111111-2222-3333-4444-555555555555'
const branch: Branch = { id: 'b1', name: 'Chilonzor filiali', address: 'Chilonzor 9', phone: '+998 71 200 00 01', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' }

describe('filiallar: ma\'lumot qatlami (v12)', () => {
  it('qator <-> model: branch_id faqat filial berilganda yuboriladi; \'\' — null (filialsiz qilish)', () => {
    expect(rowToBranch(branchToRow(branch, ORG))).toEqual(branch)
    expect(customerToRow(makeCustomer(), ORG)).not.toHaveProperty('branch_id')
    expect(customerToRow(makeCustomer({ branchId: 'b1' }), ORG)).toMatchObject({ branch_id: 'b1' })
    expect(transactionToRow(makeTransaction({ branchId: '' }), ORG)).toMatchObject({ branch_id: null })
    expect(rowToCustomer(customerToRow(makeCustomer({ branchId: 'b1' }), ORG)).branchId).toBe('b1')
    expect(rowToTransaction({ ...transactionToRow(makeTransaction(), ORG), branch_id: null })).not.toHaveProperty('branchId')
    const group = { id: 'g1', name: 'IELTS', courseId: 'k1', room: '', days: ['mon' as const], startTime: '18:00', endTime: '19:30', capacity: 12, startDate: '2026-09-01', status: 'active' as const, createdAt: '2026-09-01T00:00:00.000Z', branchId: 'b1' }
    expect(rowToGroup(groupToRow(group, ORG))).toEqual(group)
  })

  it('tekshiruv: nom 2–60, holat; noma\'lum filialga havola va takror nom tashlanadi', () => {
    expect(isBranch(branch)).toBe(true)
    expect(isBranch({ ...branch, name: 'X' })).toBe(false)
    expect(isBranch({ ...branch, status: 'deleted' })).toBe(false)
    const { data, dropped } = normalizeData({
      branches: [branch, { ...branch, id: 'b2', name: 'chilonzor filiali' }],
      customers: [makeCustomer({ branchId: 'b1' }), makeCustomer({ id: 'c2', branchId: 'yoq' })],
      transactions: [makeTransaction({ branchId: 'yoq' })],
      settings: {},
      courses: [],
    })
    expect(data.branches.map((b) => b.id)).toEqual(['b1'])
    expect(data.customers.map((c) => c.branchId)).toEqual(['b1', undefined])
    expect(data.transactions[0]).not.toHaveProperty('branchId')
    expect(dropped).toBe(1)
  })

  it('zaxira: v12 da filiallar bilan; eski (v11) zaxirada filiallar bo\'sh', () => {
    const backup = createBackup({ ...normalizeData({ customers: [], transactions: [], settings: {}, courses: [] }).data, branches: [branch] })
    expect(backup.version).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(12)
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.ok && restored.data.branches).toEqual([branch])
    const old = parseBackup(JSON.stringify({ ...backup, version: 11, branches: undefined }))
    expect(old.ok && old.data.branches).toEqual([])
  })

  it('demo markaz ikki filialda: har guruh, o\'quvchi va to\'lov filialga biriktirilgan, kirim — o\'qish guruhi filialida', () => {
    const demo = createMockData(new Date('2026-11-20T09:00:00'))
    expect(demo.branches.map((b) => b.name)).toEqual(['Chilonzor filiali', 'Yunusobod filiali'])
    expect(new Set(demo.groups.map((g) => g.branchId))).toEqual(new Set(['b1', 'b2']))
    expect(demo.customers.every((c) => c.branchId === 'b1' || c.branchId === 'b2')).toBe(true)
    const groupBranch = new Map(demo.groups.map((g) => [g.id, g.branchId]))
    const enrollmentGroup = new Map(demo.enrollments.map((e) => [e.id, e.groupId]))
    const withEnrollment = demo.transactions.filter((t) => t.enrollmentId)
    expect(withEnrollment.length).toBeGreaterThan(0)
    expect(withEnrollment.every((t) => t.branchId === groupBranch.get(enrollmentGroup.get(t.enrollmentId ?? '') ?? ''))).toBe(true)
    expect(normalizeData(demo).dropped).toBe(0)
  })
})
