// "Demo'ni ko'rish": namunaviy markaz alohida nom maydonida (eduflow-demo:*) ochiladi.
// Haqiqiy ma'lumotga tegmaydi; demo'dan chiqilganda butunlay o'chiriladi
import type { StaffUser } from '../types/user.types'
import { clearDemoStorage, createMockData, saveAll, setDemoMode, setStorageNamespace } from './storage.service'
import { saveDemoStaff } from './users.service'

export function openDemoWorkspace(): StaffUser[] {
  setStorageNamespace('demo')
  clearDemoStorage()
  saveAll(createMockData())
  setDemoMode(true)
  return saveDemoStaff()
}

export function closeDemoWorkspace(): void {
  clearDemoStorage()
  setStorageNamespace('main')
}
