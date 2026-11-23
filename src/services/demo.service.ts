// "Demo'ni ko'rish": namunaviy markaz alohida nom maydonida (eduflow-demo:*) ochiladi.
// Haqiqiy ma'lumotga tegmaydi; demo'dan chiqilganda butunlay o'chiriladi
import type { StaffUser } from '../types/user.types'
import { logAudit, resetAuditCache } from './audit.service'
import type { AuditAction } from './audit.service'
import { clearDemoStorage, saveAll, setDemoMode, setStorageNamespace } from './storage.service'
import { saveSubscription } from './subscription.service'
import type { StoredData } from './storage.service'
import { displayName, saveDemoStaff } from './users.service'

const HOUR = 3_600_000

// Jurnal bo'sh ko'rinmasin: xodimlar so'nggi kunlarda qilgan bir nechta amal
function seedDemoAudit(staff: readonly StaffUser[], data: StoredData, now = Date.now()): void {
  const [admin, manager, cashier] = staff
  const actor = (u: StaffUser) => ({ userId: u.id, userName: displayName(u), role: u.role })
  const [first, second] = data.customers
  const payment = data.transactions.find((t) => t.type === 'income')
  const rows: Array<[StaffUser, AuditAction, string, number]> = [
    [admin, 'auth.login', admin.login, 50],
    [admin, 'staff.create', `${displayName(manager)} (Menejer)`, 49],
    [manager, 'auth.login', manager.login, 30],
  ]
  if (first) rows.push([manager, 'customer.create', first.name, 29])
  if (second) rows.push([manager, 'customer.status', `${second.name}: Bog'lanildi → To'lov qildi`, 28])
  rows.push([cashier, 'auth.login', cashier.login, 6])
  if (payment) rows.push([cashier, 'payment.create', `Kirim · ${payment.customerName ?? payment.note}`, 5])
  rows.push([cashier, 'data.export', 'Tranzaksiyalar — Excel', 4])
  for (const [user, action, summary, hoursAgo] of rows) logAudit(actor(user), action, summary, undefined, new Date(now - hoursAgo * HOUR))
}

// data — services/demo/load.ts dagi loadDemoData() natijasi (generator alohida bo'lakda: avval yuklanadi,
// keyin nom maydoni almashadi — yuklanmasa hech narsa o'zgarmaydi)
export function openDemoWorkspace(data: StoredData): StaffUser[] {
  setStorageNamespace('demo')
  clearDemoStorage()
  saveAll(data)
  setDemoMode(true)
  // Demo markaz — Pro tarifida (ikki filial, cheklovsiz xodimlar): mahsulot to'liq ko'rinadi
  saveSubscription({ plan: 'pro', status: 'active', enforced: false })
  const staff = saveDemoStaff()
  seedDemoAudit(staff, data)
  resetAuditCache()
  return staff
}

export function closeDemoWorkspace(): void {
  clearDemoStorage()
  setStorageNamespace('main')
  resetAuditCache()
}
