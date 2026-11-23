import { loadWithRetry } from '../../utils/lazyRetry'
import type { StoredData } from '../storage.service'

// Demo generatorini kerak bo'lganda yuklash (tarmoq uzilsa bir marta qayta urinadi)
export async function loadDemoData(now: Date = new Date()): Promise<StoredData> {
  const module = await loadWithRetry(() => import('./data'))
  return module.createMockData(now)
}
