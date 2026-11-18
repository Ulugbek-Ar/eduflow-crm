// Tanishtiruv har xodimga bir marta ko'rsatiladi (demo markazda — shu brauzerda bir marta). Birinchi ko'rsatilgan
// zahoti belgilanadi: oxirigacha ko'rilmasa yoki sahifa yopilsa ham qayta chiqmaydi (Yordam → "Tanishtiruvni ko'rish").
// Kalit demo nom maydoniga kirmaydi (storage.service SHARED_KEYS) — demo'ga qayta kirganda ham saqlanadi
import { isRecord } from '../utils/guards'
import { readJson, setItem } from './storage.service'

export const TOUR_KEY = 'apex:tour'

export function isTourDone(key: string): boolean {
  const raw = readJson(TOUR_KEY)
  return isRecord(raw) && raw[key] === true
}

export function markTourDone(key: string): void {
  const raw = readJson(TOUR_KEY)
  setItem(TOUR_KEY, { ...(isRecord(raw) ? raw : {}), [key]: true })
}
