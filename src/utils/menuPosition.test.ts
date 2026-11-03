import { describe, expect, it } from 'vitest'
import { fixedMenuPosition } from './menuPosition'

const viewport = { width: 1000, height: 800 }
const menu = { width: 200, height: 240 }
const trigger = (top: number, left = 500) => ({ top, bottom: top + 30, left, right: left + 30 })

describe('fixedMenuPosition', () => {
  it('odatda trigger ostida ochiladi', () => {
    expect(fixedMenuPosition(trigger(100), menu, viewport, 'left')).toEqual({ top: 136, left: 500 })
  })

  it('pastda joy bo\'lmasa tepaga ochiladi', () => {
    expect(fixedMenuPosition(trigger(700), menu, viewport, 'left').top).toBe(700 - 6 - 240)
  })

  it('tepada ham joy bo\'lmasa pastda qoladi', () => {
    expect(fixedMenuPosition(trigger(120), { width: 200, height: 700 }, viewport, 'left').top).toBe(156)
  })

  it('o\'ngga tekislanadi va ekran chetidan chiqmaydi', () => {
    expect(fixedMenuPosition(trigger(100, 500), menu, viewport, 'right').left).toBe(330)
    expect(fixedMenuPosition(trigger(100, 950), menu, viewport, 'left').left).toBe(792)
    expect(fixedMenuPosition(trigger(100, 20), menu, viewport, 'right').left).toBe(8)
  })
})
