// QA: CSS regressiyalari (brauzer o'lchovlari — qa-audit/qa-reports/tests/measure.mjs)
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const block = (selector: string) => css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)))

describe('QA CSS', () => {
  it('QA-11: tanishtiruv yoritgichi left/top emas, transform bilan siljiydi (CLS yo\'q)', () => {
    expect(block('.tour-spot {')).toContain('transition: transform')
    expect(block('.tour-spot {')).not.toMatch(/transition: left|transition:[^;]*\btop /)
  })

  it('QA-12: telefonda tablar va sozlamalar menyusi o\'raladi (ekrandan chiqmaydi)', () => {
    const mobile = css.slice(css.indexOf('/* QA-12:'))
    expect(mobile).toMatch(/\.tabs,\s*\.settings-nav \{\s*flex-wrap: wrap;/)
  })

  it('QA-17: sensorli ekranda "?", saralash, havola va belgilash nishonlari ≥ 24 px', () => {
    const touch = css.slice(css.indexOf('/* QA-17:'))
    expect(touch).toContain('@media (pointer: coarse)')
    expect(touch).toMatch(/\.hint-btn \{\s*min-width: 24px;\s*min-height: 24px;/)
    expect(touch).toMatch(/input\[type='checkbox'\] \{\s*width: 24px;/)
  })
})

