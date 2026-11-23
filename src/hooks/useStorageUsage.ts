import { useSyncExternalStore } from 'react'
import { getStorageUsage, subscribeStorageUsage } from '../services/storage.service'
import type { StorageUsage } from '../services/storage.service'

// localStorage'da band joy (taxminiy) — har saqlashdan keyin avtomatik yangilanadi
export function useStorageUsage(): StorageUsage {
  return useSyncExternalStore(subscribeStorageUsage, getStorageUsage)
}
