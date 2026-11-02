import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../src/constants/app.ts'

// Statik fayllar (SVG, CSS izohi) APP_NAME ni import qila olmaydi — nom o'zgarsa, bu testlar eslatadi
const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

// Faqat matnli fayllar: rasmlardagi (docs/*.jpg, og-image.jpg) yozuvlar bu yerda tekshirilmaydi
const TEXT_FILE = /\.(ts|tsx|js|css|html|svg|md|json|toml|yml)$/

function textFiles(dir: string): string[] {
  return readdirSync(new URL(dir, root), { recursive: true, encoding: 'utf8' })
    .filter((file) => TEXT_FILE.test(file))
    .map((file) => `${dir}/${file}`)
}

describe('ilova nomi', () => {
  it('favicon.svg dagi aria-label APP_NAME bilan bir xil', () => {
    expect(read('public/favicon.svg')).toContain(`aria-label="${APP_NAME}"`)
  })

  it('index.css boshidagi izohda APP_NAME', () => {
    const header = /^\/\*[\s\S]*?\*\//.exec(read('src/index.css'))?.[0] ?? ''
    expect(header).toContain(APP_NAME)
  })

  it('eski nom (Apex Dashboard / Apex Academy) matnli fayllarda qolmagan', () => {
    const files = ['index.html', 'README.md', ...textFiles('public'), ...textFiles('src')]
    expect(files.filter((file) => /Apex (Dashboard|Academy)/.test(read(file)))).toEqual([])
  })
})
