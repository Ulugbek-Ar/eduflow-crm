import { afterEach, describe, expect, it } from 'vitest'
import { setDictionary, t } from '.'
import { RU } from './ru'

afterEach(() => setDictionary('uz', null))

describe('tarjima', () => {
  it('o\'zbekcha — kalitning o\'zi; joy belgilari almashtiriladi', () => {
    expect(t('Kirish')).toBe('Kirish')
    expect(t('Kamida {0} ta belgi', { 0: 8 })).toBe('Kamida 8 ta belgi')
  })

  it('ruscha lug\'at bilan; lug\'atda yo\'q matn o\'zbekcha qoladi', () => {
    setDictionary('ru', RU)
    expect(t('Kirish')).toBe('Войти')
    expect(t('Login yoki parol noto\'g\'ri. Yana {0} ta urinish qoldi', { 0: 3 })).toBe('Неверный логин или пароль. Осталось попыток: 3')
    expect(t('Lug\'atda yo\'q matn')).toBe('Lug\'atda yo\'q matn')
  })

  it('lug\'atdagi har bir tarjimada joy belgilari asl matndagidek', () => {
    const marks = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join()
    for (const [uz, ru] of Object.entries(RU)) expect(marks(ru), uz).toBe(marks(uz))
    expect(Object.keys(RU).length).toBeGreaterThan(800)
  })
})

describe('lug\'at to\'liqligi', () => {
  it('kodda tr(\'...\') bilan o\'ralgan har bir matnning rus tarjimasi bor', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const same = new Set(['CSV', 'Excel', 'CPL', 'ROI', '{0} — CSV', '{0} — Excel', 'Email', 'Telegram', 'Ctrl K', 'A4', 'Instagram', 'ROI, %'])
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && !full.includes('/i18n/') && !full.includes('/test/')) files.push(full)
      }
    }
    walk('src')
    const missing: string[] = []
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\btr\('((?:[^'\\]|\\.)*)'/g)) {
        const key = match[1].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1')
        if (!(key in RU) && !same.has(key)) missing.push(`${file}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })
})
