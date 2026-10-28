import type { Customer } from '../types/customer.types'
import type { Section } from '../types/dashboard.types'
import type { Transaction } from '../types/finance.types'
import { filterByPeriod, getPeriod, sumExpense, sumIncome } from './analytics'

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
  now = new Date(),
): AppNotification[] {
  const result: AppNotification[] = []

  const staleLeads = customers.filter(
    (c) => c.status === 'lead' && now.getTime() - new Date(c.createdAt).getTime() > STALE_LEAD_DAYS * DAY_MS,
  )
  if (staleLeads.length > 0) {
    result.push({
      id: `stale-leads:${staleLeads.map((c) => c.id).sort().join(',')}`,
      tone: 'warning',
      title: `${staleLeads.length} ta lead ${STALE_LEAD_DAYS} kundan beri javobsiz`,
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
      title: 'Bu oy chiqim kirimdan oshdi',
      description: `Kirim ${money(income)}, chiqim ${money(expense)}`,
      target: 'finance',
    })
  }

  if (balance < 0) {
    result.push({
      id: `negative-balance:${dayKey(now)}`,
      tone: 'danger',
      title: 'Kassa balansi manfiy',
      description: `Joriy balans: ${money(balance)}`,
      target: 'finance',
    })
  }

  return result
}
