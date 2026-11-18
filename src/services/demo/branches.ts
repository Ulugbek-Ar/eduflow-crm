// Demo markaz ikki filialda ishlaydi (filiallar imkoniyatini ko'rsatish uchun). Deterministik:
// guruhlar — navbat bilan; o'quvchi — guruhi filialida (lid — navbat bilan); kirim — o'qish guruhining, bo'lmasa
// o'quvchining filiali; maosh — o'qituvchining birinchi guruhi filiali; boshqa xarajat — navbat bilan
import type { Branch } from '../../types/branch.types'
import type { StoredData } from '../storage.service'

export const DEMO_BRANCHES: ReadonlyArray<Pick<Branch, 'id' | 'name' | 'address' | 'phone'>> = [
  { id: 'b1', name: 'Chilonzor filiali', address: 'Toshkent, Chilonzor 9-kvartal', phone: '+998 71 200 00 01' },
  { id: 'b2', name: 'Yunusobod filiali', address: 'Toshkent, Yunusobod 4-mavze', phone: '+998 71 200 00 02' },
]

export function withDemoBranches(data: Omit<StoredData, 'branches'>, now: Date): StoredData {
  const earliest = data.customers.reduce((min, c) => (c.createdAt < min ? c.createdAt : min), now.toISOString())
  const branches: Branch[] = DEMO_BRANCHES.map((b) => ({ ...b, status: 'active', createdAt: earliest }))
  const pick = (index: number) => DEMO_BRANCHES[index % DEMO_BRANCHES.length].id
  const groups = data.groups.map((g, index) => ({ ...g, branchId: pick(index) }))
  const groupBranch = new Map(groups.map((g) => [g.id, g.branchId]))
  const enrollmentBranch = new Map(data.enrollments.map((e) => [e.id, groupBranch.get(e.groupId)]))
  // O'quvchining birinchi o'qishi qaysi filial guruhida bo'lsa — o'sha filial
  const studentBranch = new Map<string, string>()
  for (const e of data.enrollments) {
    const branch = groupBranch.get(e.groupId)
    if (branch && !studentBranch.has(e.customerId)) studentBranch.set(e.customerId, branch)
  }
  const customers = data.customers.map((c, index) => ({ ...c, branchId: studentBranch.get(c.id) ?? pick(index) }))
  const customerBranch = new Map(customers.map((c) => [c.id, c.branchId]))
  const teacherBranch = new Map<string, string>()
  for (const g of groups) if (g.teacherId && !teacherBranch.has(g.teacherId)) teacherBranch.set(g.teacherId, g.branchId)
  let expenseIndex = 0
  const transactions = data.transactions.map((t) => {
    const fromCustomer = (t.enrollmentId && enrollmentBranch.get(t.enrollmentId)) || (t.customerId && customerBranch.get(t.customerId))
    const branchId = fromCustomer || (t.teacherId && teacherBranch.get(t.teacherId)) || pick(expenseIndex++)
    return { ...t, branchId }
  })
  return { ...data, groups, customers, transactions, branches }
}
