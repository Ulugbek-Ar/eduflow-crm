import { tr } from '../i18n'
import type { Customer } from '../types/customer.types'
import type { Section } from '../types/dashboard.types'
import type { Transaction } from '../types/finance.types'
import type { Course } from '../types/course.types'
import { filterByPeriod, getPeriod, sumExpense, sumIncome } from './analytics'
import { computeDebts, totalDebt } from './debts'

export interface AppNotification {
  // Holat o'zgarsa id ham o'zgaradi va eslatma qaytadan "o'qilmagan" bo'ladi
  id: string
  tone: 'warning' | 'danger' | 'info'
  title: string
  description: string
  target: Section
}

export const STALE_LEAD_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function buildNotifications(
  customers: readonly Customer[],
  transactions: readonly Transaction[],
  balance: number,
  money: (amount: number) => string,
  courses: readonly Course[] = [],
  now = new Date(),
): AppNotification[] {
  const result: AppNotification[] = []

  const debts = computeDebts(customers, courses, transactions, now)
  if (debts.length > 0) {
    result.push({
      id: `debts:${now.getFullYear()}-${now.getMonth() + 1}:${debts.map((d) => `${d.customer.id}=${d.debt}`).join(',')}`,
      tone: 'warning',
      title: tr('{0} ta mijozning shu oy qarzi bor', { 0: debts.length }),
      description: tr('Jami qarz: {0}', { 0: money(totalDebt(debts)) }),
      target: 'finance',
    })
  }

  const staleLeads = customers.filter(
    (c) => c.status === 'new' && now.getTime() - new Date(c.createdAt).getTime() > STALE_LEAD_DAYS * DAY_MS,
  )
  if (staleLeads.length > 0) {
    result.push({
      id: `stale-leads:${staleLeads.map((c) => c.id).sort().join(',')}`,
      tone: 'warning',
      title: tr('{0} ta yangi lid {1} kundan beri bog\'lanilmagan', { 0: staleLeads.length, 1: STALE_LEAD_DAYS }),
      description: staleLeads
        .slice(0, 3)
        .map((c) => c.name)
        .join(', ') + (staleLeads.length > 3 ? ' va boshqalar' : ''),
      target: 'customers',
    })
  }

  const month = filterByPeriod(transactions, (t) => t.date, getPeriod('month', now))
  const income = sumIncome(month)
  const expense = sumExpense(month)
  if (expense > income) {
    result.push({
      id: `expense-over:${now.getFullYear()}-${now.getMonth() + 1}`,
      tone: 'danger',
      title: tr('Bu oy chiqim kirimdan oshdi'),
      description: tr('Kirim {0}, chiqim {1}', { 0: money(income), 1: money(expense) }),
      target: 'finance',
    })
  }

  if (balance < 0) {
    result.push({
      id: `negative-balance:${dayKey(now)}`,
      tone: 'danger',
      title: tr('Kassa balansi manfiy'),
      description: tr('Joriy balans: {0}', { 0: money(balance) }),
      target: 'finance',
    })
  }

  return result
}
