import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function vercelCsp(): string | undefined {
  const config = JSON.parse(read('vercel.json')) as { headers: Array<{ headers: Array<{ key: string; value: string }> }> }
  return config.headers.flatMap((rule) => rule.headers).find((h) => h.key === 'Content-Security-Policy')?.value
}

function netlifyCsp(): string | undefined {
  return /Content-Security-Policy = "([^"]+)"/.exec(read('netlify.toml'))?.[1]
}

describe('deploy xavfsizlik sarlavhalari', () => {
  it('vercel.json va netlify.toml dagi CSP bir xil', () => {
    expect(vercelCsp()).toBeDefined()
    expect(netlifyCsp()).toBe(vercelCsp())
  })

  it('CSP talab qilingan direktivalarni o\'z ichiga oladi', () => {
    const directives = new Map(
      (vercelCsp() ?? '').split(';').map((part) => {
        const [name, ...values] = part.trim().split(/\s+/)
        return [name, values.join(' ')]
      }),
    )
    expect(directives.get('default-src')).toBe('\'self\'')
    expect(directives.get('script-src')).toBe('\'self\'')
    expect(directives.get('style-src')).toBe('\'self\' \'unsafe-inline\'')
    expect(directives.get('img-src')).toBe('\'self\' data: blob:')
    expect(directives.get('frame-ancestors')).toBe('\'none\'')
  })

  it('index.html da inline skript yo\'q (script-src \'self\' bilan ishlaydi)', () => {
    const scripts = read('index.html').match(/<script\b[^>]*>/g) ?? []
    expect(scripts.length).toBeGreaterThan(0)
    for (const tag of scripts) expect(tag).toMatch(/\bsrc="/)
    expect(read('index.html')).not.toMatch(/\son[a-z]+="/)
  })
})
