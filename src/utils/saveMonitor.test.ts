import { describe, expect, it } from 'vitest'
import { createSaveMonitor } from './saveMonitor'

const quota = { ok: false, reason: 'quota' } as const
const ok = { ok: true } as const

describe('createSaveMonitor', () => {
  it('bir xil xato faqat bir marta xabar qilinadi', () => {
    const monitor = createSaveMonitor()
    expect(monitor.report('a', quota)).toBe('quota')
    expect(monitor.report('a', quota)).toBeNull()
    expect(monitor.report('b', quota)).toBeNull()
    expect(monitor.isFailing()).toBe(true)
  })

  it('boshqa kalitning muvaffaqiyati xatoni "unutdirmaydi"', () => {
    const monitor = createSaveMonitor()
    monitor.report('a', quota)
    expect(monitor.report('b', ok)).toBeNull()
    expect(monitor.report('a', quota)).toBeNull()
  })

  it('hammasi saqlangach keyingi xato yana xabar qilinadi', () => {
    const monitor = createSaveMonitor()
    monitor.report('a', quota)
    monitor.report('a', ok)
    expect(monitor.isFailing()).toBe(false)
    expect(monitor.report('a', quota)).toBe('quota')
  })

  it('yangi turdagi xato alohida xabar qilinadi', () => {
    const monitor = createSaveMonitor()
    monitor.report('a', quota)
    expect(monitor.report('b', { ok: false, reason: 'unavailable' })).toBe('unavailable')
  })
})
