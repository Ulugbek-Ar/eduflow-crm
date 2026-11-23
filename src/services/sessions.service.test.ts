// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  describeDevice,
  endSession,
  isSessionActive,
  listSessions,
  readTabSession,
  revokeOtherSessions,
  revokeUserSessions,
  SESSION_TTL_MS,
  SESSIONS_KEY,
  startSession,
  TAB_SESSION_KEY,
  touchSession,
} from './sessions.service'
import { setStorageNamespace } from './storage.service'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setStorageNamespace('main')
})

describe('seanslar', () => {
  it('kirish yozuvi va tab seansi yaratiladi, chiqishda o\'chiriladi', () => {
    const session = startSession('u1')
    expect(readTabSession()).toEqual(session)
    expect(isSessionActive(session.id)).toBe(true)
    endSession(session.id)
    expect(readTabSession()).toBeNull()
    expect(isSessionActive(session.id)).toBe(false)
  })

  it('eski format ({ login }) login orqali tiklash uchun belgilanadi', () => {
    sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify({ login: 'direktor', startedAt: new Date().toISOString() }))
    expect(readTabSession()).toEqual({ legacyLogin: 'direktor' })
  })

  it('xodimning barcha seanslari yoki joriydan boshqa hammasi yopiladi', () => {
    const a = startSession('u1')
    const b = startSession('u2')
    const c = startSession('u2')
    revokeUserSessions('u2', c.id)
    expect(listSessions().map((s) => s.id).sort()).toEqual([a.id, c.id].sort())
    revokeOtherSessions(a.id)
    expect(listSessions().map((s) => s.id)).toEqual([a.id])
    expect(b.id).not.toBe(a.id)
  })

  it('30 kun faolsiz seans ro\'yxatdan tushadi; faollik vaqti yangilanadi', () => {
    const old = new Date(Date.now() - SESSION_TTL_MS - 1000).toISOString()
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([{ id: 's-old', userId: 'u1', startedAt: old, lastSeenAt: old, device: 'Chrome' }]))
    expect(listSessions()).toEqual([])

    const session = startSession('u1', new Date(Date.now() - 10 * 60_000))
    touchSession(session.id)
    expect(Date.parse(listSessions()[0].lastSeenAt)).toBeGreaterThan(Date.now() - 5000)
  })

  it('demo rejimdagi tab seansi alohida kalitda', () => {
    setStorageNamespace('demo')
    startSession('demo-u1')
    expect(sessionStorage.getItem('eduflow-demo:session')).not.toBeNull()
    expect(sessionStorage.getItem(TAB_SESSION_KEY)).toBeNull()
    expect(localStorage.getItem('eduflow-demo:sessions')).not.toBeNull()
  })
})

describe('qurilma nomi', () => {
  it('brauzer va tizim', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toBe(
      'Chrome · Windows',
    )
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe(
      'Safari · iOS',
    )
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 YaBrowser/24.1 Mobile Safari/537.36')).toBe(
      'Yandex Browser · Android',
    )
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge · Windows')
    expect(describeDevice('curl/8')).toBe('Brauzer')
  })
})
