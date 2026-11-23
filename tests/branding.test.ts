import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { brandSlug, DEFAULT_BRAND_NAME, resolveBrand } from '../src/constants/brand.ts'

// Sayt nomi va logosi mijozga qarab o'zgaradi (VITE_BRAND_*): ular kodga yozilmasligi kerak — bu testlar eslatadi
const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

// Faqat matnli fayllar: rasmlardagi (docs/*.jpg, og-image.jpg) yozuvlar bu yerda tekshirilmaydi
const TEXT_FILE = /\.(ts|tsx|js|css|html|svg|md|json|toml|yml)$/

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(new URL(dir, root), { recursive: true, encoding: 'utf8' })
    .filter((file) => pattern.test(file))
    .map((file) => `${dir}/${file}`)
}

describe('brend (sayt nomi va logosi)', () => {
  it('standart va berilgan qiymatlar; qisqa nom va fayl prefiksi; logo manzili tekshiriladi', () => {
    const fallback = resolveBrand({})
    expect(fallback).toMatchObject({ name: DEFAULT_BRAND_NAME, shortName: 'EduFlow', slug: 'eduflow', logo: '', favicon: '/favicon.svg', appleIcon: '/apple-touch-icon.png', ogImage: '/og-image.jpg' })
    const custom = resolveBrand({ VITE_BRAND_NAME: '  Bilim   CRM ', VITE_BRAND_LOGO: '/brand/logo.png', VITE_BRAND_OG_IMAGE: 'https://cdn.bilim.uz/og.jpg' })
    expect(custom).toMatchObject({ name: 'Bilim CRM', shortName: 'Bilim', slug: 'bilim', logo: '/brand/logo.png', favicon: '/brand/logo.png', ogImage: 'https://cdn.bilim.uz/og.jpg' })
    expect(resolveBrand({ VITE_BRAND_NAME: 'Ilm', VITE_BRAND_SHORT_NAME: 'Ilm Ziyo', VITE_BRAND_FAVICON: '/f.ico' })).toMatchObject({ shortName: 'Ilm Ziyo', slug: 'ilm-ziyo', favicon: '/f.ico' })
    // Xavfli yoki nisbiy manzil — e'tiborsiz
    expect(resolveBrand({ VITE_BRAND_LOGO: 'javascript:alert(1)' }).logo).toBe('')
    expect(resolveBrand({ VITE_BRAND_LOGO: '//evil.example/logo.svg' }).logo).toBe('')
    // Tashqi logo — sayt CSP'si yuklatmaydi, shuning uchun qabul qilinmaydi (havola rasmi — mumkin)
    expect(resolveBrand({ VITE_BRAND_LOGO: 'https://cdn.example.uz/logo.svg' }).logo).toBe('')
    expect(brandSlug('Oʻquv Markaz')).toBe('oquv-markaz')
    expect(brandSlug('Учебный центр')).toBe('crm')
  })

  it('index.html va route sahifalari skriptida nom yozilmagan — faqat brenddan (%APP_NAME%)', () => {
    const html = read('index.html')
    expect(html).not.toContain(DEFAULT_BRAND_NAME)
    expect(html).toContain('<title>%APP_NAME%</title>')
    expect(html).toContain('href="%BRAND_FAVICON%"')
    expect(html).toContain('content="%BRAND_OG_IMAGE%"')
    expect(read('scripts/spa-routes.mjs')).not.toMatch(/EduFlow/)
    expect(read('public/favicon.svg')).not.toMatch(/EduFlow/)
  })

  it('ilova kodida brend nomi matn sifatida yozilmagan (APP_NAME / BRAND dan olinadi)', () => {
    const allowed = new Set(['src/constants/brand.ts'])
    const quoted = /(['"`])[^'"`\n]*EduFlow[^'"`\n]*\1/
    const offenders = files('src', /\.(ts|tsx)$/)
      .filter((file) => !allowed.has(file) && !/\.test\.tsx?$/.test(file) && !file.startsWith('src/i18n/'))
      .filter((file) => quoted.test(read(file)))
    expect(offenders).toEqual([])
  })

  it('eski nom (Apex Dashboard / Apex Academy) matnli fayllarda qolmagan', () => {
    const list = ['index.html', 'README.md', ...files('public', TEXT_FILE), ...files('src', TEXT_FILE)]
    expect(list.filter((file) => /Apex (Dashboard|Academy)/.test(read(file)))).toEqual([])
  })
})
