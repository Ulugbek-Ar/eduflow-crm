// Tanishtiruv har xodimga bir marta ko'rsatiladi (demo markazda — bir marta hammaga)
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
