// Filiallar (v12): standart filial va filiallar bo'yicha taqqoslash
import type { Branch } from '../types/branch.types'
import type { Customer } from '../types/customer.types'
import type { Transaction } from '../types/finance.types'
import type { Enrollment, Group } from '../types/group.types'
import { filterByPeriod, sumExpense, sumIncome } from './analytics'
import type { Period } from './analytics'

// Yangi yozuv uchun standart filial: cheklangan xodimniki, Header'da tanlangani yoki birinchi faol filial
export function defaultBranchId(branches: readonly Branch[], branchFilter: string, restrictedBranch?: string): string {
  return restrictedBranch ?? (branchFilter || branches.find((b) => b.status === 'active')?.id || '')
}

export interface BranchStat {
  // null — umumiy (filialsiz) kirim va xarajatlar
  branch: Branch | null
  // Faol o'qishi bor o'quvchilar (filial guruhlarida)
  students: number
  groups: number
  income: number
  expense: number
  profit: number
}

// Davr bo'yicha har filial: o'quvchi va guruhlar (hozir), to'langan kirim, xarajat va foyda.
// Filialsiz to'lovlar bo'lsa — alohida "umumiy" qator (xarajatni filiallarga taqsimlamaymiz)
export function branchStats(
  branches: readonly Branch[],
  data: { customers: readonly Customer[]; groups: readonly Group[]; enrollments: readonly Enrollment[]; transactions: readonly Transaction[] },
  period: Period,
): BranchStat[] {
  const live = new Set(data.customers.map((c) => c.id))
  const inPeriod = filterByPeriod(data.transactions, (t) => t.date, period)
  const known = new Set(branches.map((b) => b.id))
  const money = (list: readonly Transaction[]) => {
    const income = sumIncome(list)
    const expense = sumExpense(list)
    return { income, expense, profit: income - expense }
  }
  const rows: BranchStat[] = branches
    .filter((b) => b.status === 'active')
    .map((branch) => {
      const groupIds = new Set(data.groups.filter((g) => g.branchId === branch.id && g.status === 'active').map((g) => g.id))
      const students = new Set(data.enrollments.filter((e) => e.status === 'active' && groupIds.has(e.groupId) && live.has(e.customerId)).map((e) => e.customerId))
      return { branch, students: students.size, groups: groupIds.size, ...money(inPeriod.filter((t) => t.branchId === branch.id)) }
    })
  const general = inPeriod.filter((t) => !t.branchId || !known.has(t.branchId))
  if (general.some((t) => t.status === 'paid')) rows.push({ branch: null, students: 0, groups: 0, ...money(general) })
  return rows
}
