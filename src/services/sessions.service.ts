// Seanslar: har bir kirish yozuvi (apex:sessions) va shu tabdagi joriy seans (sessionStorage).
// Administrator seansni yopsa yoki xodimni bloklasa — boshqa tablarda ham darhol chiqib ketadi (storage hodisasi).
// Lokal rejimda bu faqat shu brauzerdagi seanslar; Supabase rejimida — barcha qurilmalar
import type { SessionRecord } from '../types/user.types'
import { createId } from '../utils/format'
import { isIsoDate, isRecord, isText, keepValid } from '../utils/guards'
import { physicalKey, readJson, setItem } from './storage.service'

export const SESSIONS_KEY = 'apex:sessions'
// Tab yopilganda tugaydi
export const TAB_SESSION_KEY = 'apex:session'

// 30 kun faolsiz seans eskirgan hisoblanadi
export const SESSION_TTL_MS = 30 * 86_400_000
const MAX_SESSIONS = 50
// lastSeenAt har daqiqada bir martadan ko'p yozilmaydi
const TOUCH_INTERVAL_MS = 60_000

export interface TabSession {
  id: string
  userId: string
  startedAt: string
}

// 27-bosqichgacha: { login, startedAt } — kirish qayta so'ralmasligi uchun login orqali tiklanadi
export type StoredTabSession = TabSession | { legacyLogin: string }

function isSessionRecord(value: unknown): value is SessionRecord {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.userId) &&
    isIsoDate(value.startedAt) &&
    isIsoDate(value.lastSeenAt) &&
    typeof value.device === 'string'
  )
}

function prune(records: readonly SessionRecord[], now = Date.now()): SessionRecord[] {
  return records
    .filter((r) => now - Date.parse(r.lastSeenAt) < SESSION_TTL_MS)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, MAX_SESSIONS)
}

export function listSessions(now = Date.now()): SessionRecord[] {
  const raw = readJson(SESSIONS_KEY)
  return Array.isArray(raw) ? prune(keepValid(raw, isSessionRecord), now) : []
}

function saveSessions(records: readonly SessionRecord[]): void {
  setItem(SESSIONS_KEY, records)
}

export function isSessionActive(id: string): boolean {
  return listSessions().some((r) => r.id === id)
}

// "Chrome · Windows" — brauzer va tizim nomi (aniq versiyasiz)
export function describeDevice(userAgent: string): string {
  const ua = userAgent
  const browser = /YaBrowser\//.test(ua)
    ? 'Yandex Browser'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\/|Opera/.test(ua)
        ? 'Opera'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Brauzer'
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return os ? `${browser} · ${os}` : browser
}

function currentDevice(): string {
  return typeof navigator === 'undefined' ? 'Brauzer' : describeDevice(navigator.userAgent)
}

export function readTabSession(): StoredTabSession | null {
  try {
    const raw = sessionStorage.getItem(physicalKey(TAB_SESSION_KEY))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!isRecord(parsed)) return null
    if (isText(parsed.id) && isText(parsed.userId) && isIsoDate(parsed.startedAt)) {
      return { id: parsed.id, userId: parsed.userId, startedAt: parsed.startedAt }
    }
    return isText(parsed.login) ? { legacyLogin: parsed.login } : null
  } catch {
    return null
  }
}

function writeTabSession(session: TabSession | null): void {
  try {
    const key = physicalKey(TAB_SESSION_KEY)
    if (session) sessionStorage.setItem(key, JSON.stringify(session))
    else sessionStorage.removeItem(key)
  } catch {
    // Sessiyani saqlab bo'lmasa, sahifa yangilanguncha ishlaydi
  }
}

export function startSession(userId: string, now = new Date()): TabSession {
  const session: TabSession = { id: createId('s'), userId, startedAt: now.toISOString() }
  const record: SessionRecord = { id: session.id, userId, startedAt: session.startedAt, lastSeenAt: session.startedAt, device: currentDevice() }
  saveSessions(prune([record, ...listSessions(now.getTime())], now.getTime()))
  writeTabSession(session)
  return session
}

// Shu tabdan chiqish: yozuv ham o'chiriladi (boshqa tablar ta'sirlanmaydi)
export function endSession(id?: string): void {
  if (id) saveSessions(listSessions().filter((r) => r.id !== id))
  writeTabSession(null)
}

export function touchSession(id: string, now = Date.now()): void {
  const records = listSessions(now)
  const record = records.find((r) => r.id === id)
  if (!record || now - Date.parse(record.lastSeenAt) < TOUCH_INTERVAL_MS) return
  saveSessions(records.map((r) => (r.id === id ? { ...r, lastSeenAt: new Date(now).toISOString() } : r)))
}

export function revokeSession(id: string): void {
  saveSessions(listSessions().filter((r) => r.id !== id))
}

// Xodim bloklanganda yoki paroli tiklanganda — uning barcha seanslari yopiladi
export function revokeUserSessions(userId: string, exceptId?: string): void {
  saveSessions(listSessions().filter((r) => r.userId !== userId || r.id === exceptId))
}

// "Boshqa barcha seanslarni yopish" — joriy seansdan tashqari hammasi
export function revokeOtherSessions(currentId: string): void {
  saveSessions(listSessions().filter((r) => r.id === currentId))
}
