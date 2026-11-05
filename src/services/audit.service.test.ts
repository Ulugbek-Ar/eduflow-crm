// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  actionCategory,
  AUDIT_KEY,
  AUDIT_RETENTION_MS,
  EMPTY_AUDIT_FILTERS,
  filterAudit,
  isAuditEntry,
  logAudit,
  MAX_AUDIT_ENTRIES,
  readAudit,
} from './audit.service'
import { setStorageNamespace } from './storage.service'

const admin = { userId: 'u1', userName: 'Dilshod Karimov', role: 'admin' as const }
const cashier = { userId: 'u2', userName: 'Sardor Qodirov', role: 'cashier' as const }

beforeEach(() => {
  localStorage.clear()
  setStorageNamespace('main')
})

describe('amallar jurnali', () => {
  it('yozuv qo\'shiladi, eng yangisi birinchi; xodim ismi snapshot sifatida saqlanadi', () => {
    logAudit(admin, 'customer.create', 'Aziza Karimova', 'c1', new Date('2026-11-01T10:00:00Z'))
    logAudit(cashier, 'payment.create', 'Kirim 650 000 so\'m', 't1', new Date('2026-11-02T10:00:00Z'))
    const entries = readAudit(Date.parse('2026-11-03T00:00:00Z'))
    expect(entries.map((e) => e.action)).toEqual(['payment.create', 'customer.create'])
    expect(entries[1]).toMatchObject({ userName: 'Dilshod Karimov', role: 'admin', summary: 'Aziza Karimova', entityId: 'c1' })
  })

  it('kim ekani noma\'lum bo\'lsa ham yoziladi (noto\'g\'ri kirish urinishi)', () => {
    const entry = logAudit(null, 'auth.failed', 'Noto\'g\'ri login yoki parol: admin')
    expect(entry).toMatchObject({ userId: '', userName: 'Noma\'lum' })
    expect(entry.role).toBeUndefined()
  })

  it('1 yildan eski va 3000 tadan ortiq yozuvlar tushib qoladi', () => {
    const now = Date.now()
    logAudit(admin, 'auth.login', 'eski', undefined, new Date(now - AUDIT_RETENTION_MS - 1000))
    expect(readAudit(now)).toEqual([])
    const many = Array.from({ length: MAX_AUDIT_ENTRIES + 5 }, (_, i) => ({
      id: `a${i}`,
      at: new Date(now - i * 1000).toISOString(),
      action: 'auth.login',
      userId: 'u1',
      userName: 'D',
      summary: '',
    }))
    localStorage.setItem(AUDIT_KEY, JSON.stringify(many))
    expect(readAudit(now)).toHaveLength(MAX_AUDIT_ENTRIES)
  })

  it('buzuq yozuvlar tashlanadi', () => {
    localStorage.setItem(AUDIT_KEY, JSON.stringify([{ id: 'x', at: 'kecha', action: 'auth.login' }, { id: 'y', at: new Date().toISOString(), action: 'hack', userId: '', userName: '', summary: '' }]))
    expect(readAudit()).toEqual([])
    expect(isAuditEntry({ id: 'z', at: new Date().toISOString(), action: 'auth.login', userId: 'u', userName: 'U', summary: '', role: 'boss' })).toBe(false)
  })

  it('demo rejim jurnali alohida', () => {
    setStorageNamespace('demo')
    logAudit(admin, 'auth.login', 'demo')
    setStorageNamespace('main')
    expect(readAudit()).toEqual([])
    expect(localStorage.getItem('eduflow-demo:audit')).toContain('demo')
  })
})

describe('jurnal filtri', () => {
  it('xodim, bo\'lim, sana va matn bo\'yicha', () => {
    logAudit(admin, 'customer.create', 'Aziza Karimova', 'c1', new Date(2026, 10, 1, 10))
    logAudit(cashier, 'payment.create', 'Kirim 650 000 so\'m · Aziza Karimova', 't1', new Date(2026, 10, 3, 10))
    logAudit(admin, 'staff.block', 'Sardor Qodirov', 'u2', new Date(2026, 10, 5, 10))
    const all = readAudit(new Date(2026, 10, 6).getTime())
    const f = (patch: Partial<typeof EMPTY_AUDIT_FILTERS>) => filterAudit(all, { ...EMPTY_AUDIT_FILTERS, ...patch }).map((e) => e.action)
    expect(f({ userId: 'u2' })).toEqual(['payment.create'])
    expect(f({ category: 'staff' })).toEqual(['staff.block'])
    expect(f({ from: '2026-11-02', to: '2026-11-04' })).toEqual(['payment.create'])
    expect(f({ query: 'aziza' })).toEqual(['payment.create', 'customer.create'])
    expect(f({ query: 'bloklandi' })).toEqual(['staff.block'])
  })

  it('amal -> bo\'lim', () => {
    expect(actionCategory('session.revoke')).toBe('auth')
    expect(actionCategory('trash.purge')).toBe('data')
    expect(actionCategory('course.restore')).toBe('courses')
  })
})
