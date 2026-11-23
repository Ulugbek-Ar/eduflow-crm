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
})
