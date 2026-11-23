#!/usr/bin/env node
// Skrinshotlar: README uchun docs/*.jpg va landing uchun public/landing/*.webp (+ .jpg zaxira) qayta yaratiladi.
// Demo ma'lumot (?demo=1), yorug' va qorong'i mavzu, 1440 va 390 px. WebP — Chromium canvas'ida kodlanadi
// (qo'shimcha kutubxonasiz), 1440 px WebP ≤ 80 KB bo'lguncha sifat tanlanadi.
//
// Ishlatish:
//   npm run build && npm run screenshots
//   node scripts/screenshots.mjs --url http://localhost:4174      # ishlab turgan serverdan
//   node scripts/screenshots.mjs --only overview,finance           # faqat tanlanganlari
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = path.join(root, 'docs')
const LANDING = path.join(root, 'public', 'landing')
const args = process.argv.slice(2)
const option = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const only = option('only')?.split(',').map((s) => s.trim()).filter(Boolean)
const PORT = 4179
const LIMITS = { 1440: 80 * 1024, 720: 28 * 1024, 390: 30 * 1024 }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function startPreview() {
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`)
      if (res.ok) return child
    } catch {
      // hali ishga tushmagan
    }
    await sleep(500)
  }
  child.kill()
  throw new Error('vite preview ishga tushmadi — avval `npm run build` qiling')
}

// Namuna import fayli (import oynasi skrinshoti uchun): 1 takror, 1 xato telefon, 1 yangi kurs
const IMPORT_CSV = [
  'ФИО;Телефон;Курс;Источник;Статус',
  'Bobur Aliyev;998931112233;Ingliz tili (IELTS);Instagram;Оплатил',
  'Dilnoza Rahimova;93 222 33 44;Robototexnika;Telegram;думает',
  'Bobur Aliyev;+998 93 111 22 33;;;',
  'Kamola Yusupova;12345;;;',
  "Laylo Nazarova;97 444 55 66;Matematika (DTM);Tavsiya;Bog'lanildi",
].join('\r\n')

async function newPage(browser, { width, height, theme }) {
  const mobile = width < 600
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: 'uz-UZ',
    colorScheme: theme,
    reducedMotion: 'reduce',
    // Demo paneli va bildirishnomalarni yashirish uchun <style> qo'shiladi
    bypassCSP: true,
  })
  await context.addInitScript(([t]) => {
    try {
      if (!sessionStorage.getItem('__shots')) {
        localStorage.clear()
        localStorage.setItem('apex:theme', JSON.stringify(t))
        localStorage.setItem('apex:lang', JSON.stringify('uz'))
        sessionStorage.setItem('__shots', '1')
      }
    } catch {
      // saqlash yopiq — standart mavzu
    }
  }, [theme])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return { context, page, errors }
}

const CLEAN = '.demo-bar, .demo-banner, .toast-region { display: none !important; } * { caret-color: transparent !important; }'

async function openDemo(page, base) {
  await page.goto(`${base}/app?demo=1`)
  await page.getByRole('button', { name: "O'tkazib yuborish" }).click({ timeout: 8000 }).catch(() => undefined)
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}

async function goTo(page, label) {
  if ((page.viewportSize()?.width ?? 1440) < 600) {
    await page.getByRole('navigation', { name: 'Pastki menyu' }).getByRole('button', { name: 'Menyu' }).click()
  }
  await page.locator('.sidebar-nav').getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('heading', { level: 1, name: label }).waitFor()
  await settle(page)
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(450)
}

// Ekran ko'rinishi: demo paneli va bildirishnomalarsiz
async function capture(page, type = 'png', quality = 80) {
  await page.addStyleTag({ content: CLEAN })
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  await page.waitForTimeout(150)
  return page.screenshot(type === 'jpeg' ? { type, quality } : { type })
}

// PNG -> WebP (berilgan kenglikda), hajm chegarasiga sig'adigan eng yuqori sifat
async function toWebp(encoder, png, width, maxBytes) {
  const base64 = await encoder.evaluate(
    async ({ src, width, maxBytes }) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = Math.round((img.height * width) / img.width)
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const encode = (q) => new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', q))
      let lo = 0.3
      let hi = 0.92
      let best = await encode(lo)
      for (let i = 0; i < 7; i++) {
        const q = (lo + hi) / 2
        const blob = await encode(q)
        if (blob.size <= maxBytes) {
          best = blob
          lo = q
        } else hi = q
      }
      const bytes = new Uint8Array(await best.arrayBuffer())
      let binary = ''
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(binary)
    },
    { src: `data:image/png;base64,${png.toString('base64')}`, width, maxBytes },
  )
  return Buffer.from(base64, 'base64')
}

const written = []
async function save(file, buffer) {
  await writeFile(file, buffer)
  written.push(`${path.relative(root, file)} — ${(buffer.length / 1024).toFixed(1)} KB`)
}

// Bitta ekran: docs/<name>.jpg; landing berilsa — public/landing/<landing>.jpg va .webp (1440/720 yoki 390)
async function shoot(ctx, spec) {
  const { browser, encoder, base } = ctx
  if (only && !only.includes(spec.name)) return
  const width = spec.width ?? 1440
  const { context, page, errors } = await newPage(browser, { width, height: width < 600 ? 844 : 900, theme: spec.theme })
  try {
    if (spec.landingPage) {
      // Landing rasmlari — shu skript hozirgina yozgan public/landing fayllaridan (dist eski bo'lishi mumkin)
      await page.route('**/landing/*', async (route) => {
        const file = path.join(LANDING, path.basename(new URL(route.request().url()).pathname))
        await route.fulfill({ path: file }).catch(() => route.continue())
      })
      await page.goto(`${base}/`)
      await page.waitForLoadState('networkidle')
      await settle(page)
    } else {
      await openDemo(page, base)
      await spec.run?.(page)
    }
    const png = await capture(page)
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 80 })
    if (spec.docs !== false) await save(path.join(DOCS, `${spec.name}.jpg`), jpeg)
    if (spec.landing) {
      await save(path.join(LANDING, `${spec.landing}.jpg`), await page.screenshot({ type: 'jpeg', quality: 78 }))
      for (const w of width < 600 ? [390] : [720, 1440]) await save(path.join(LANDING, `${spec.landing}-${w}.webp`), await toWebp(encoder, png, w, LIMITS[w]))
    }
    if (errors.length) console.warn(`  ${spec.name}: konsol xatolari: ${errors.join(' | ')}`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 0) console.warn(`  ${spec.name}: gorizontal scroll ${overflow}px`)
  } finally {
    await context.close()
  }
}

const SHOTS = [
  { name: 'overview-light', theme: 'light', landing: 'overview' },
  { name: 'overview-dark', theme: 'dark' },
  { name: 'kanban-light', theme: 'light', landing: 'customers', run: async (p) => (await goTo(p, 'Mijozlar va lidlar'), await p.getByRole('button', { name: 'Kanban' }).click(), await settle(p)) },
  { name: 'kanban-dark', theme: 'dark', run: async (p) => (await goTo(p, 'Mijozlar va lidlar'), await p.getByRole('button', { name: 'Kanban' }).click(), await settle(p)) },
  { name: 'groups-light', theme: 'light', run: (p) => goTo(p, 'Guruhlar') },
  {
    name: 'attendance-light',
    theme: 'light',
    landing: 'attendance',
    run: async (p) => {
      await goTo(p, 'Guruhlar')
      await p.locator('table .link-btn').filter({ hasText: 'IELTS — kechki' }).click()
      const drawer = p.getByRole('dialog', { name: 'IELTS — kechki' })
      await drawer.getByRole('tab', { name: 'Davomat' }).click()
      await drawer.locator('table.att-grid').waitFor()
      await settle(p)
    },
  },
  { name: 'schedule-light', theme: 'light', docs: false, landing: 'schedule', run: (p) => goTo(p, 'Dars jadvali') },
  { name: 'schedule-dark', theme: 'dark', run: (p) => goTo(p, 'Dars jadvali') },
  { name: 'teachers-dark', theme: 'dark', run: async (p) => (await goTo(p, "O'qituvchilar"), await p.getByRole('tab', { name: 'Maosh' }).click(), await settle(p)) },
  { name: 'finance-light', theme: 'light', landing: 'finance', run: (p) => goTo(p, 'Moliya va kassa') },
  { name: 'finance-dark', theme: 'dark', run: (p) => goTo(p, 'Moliya va kassa') },
  {
    name: 'debts-dark',
    theme: 'dark',
    run: async (p) => {
      await goTo(p, 'Moliya va kassa')
      const card = p.locator('section[aria-labelledby="debts-title"]')
      await card.evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await card.locator('tbody tr').first().getByRole('button', { name: /: eslatma$/ }).click()
      await p.getByRole('dialog').waitFor()
      await settle(p)
    },
  },
  {
    name: 'import-light',
    theme: 'light',
    run: async (p) => {
      await goTo(p, 'Mijozlar va lidlar')
      await p.getByRole('button', { name: 'Import', exact: true }).click()
      await p.locator('.modal input[type="file"]').setInputFiles({ name: 'mijozlar.csv', mimeType: 'text/csv', buffer: Buffer.from(IMPORT_CSV, 'utf8') })
      await p.getByRole('group', { name: 'Ustunlarni moslashtirish' }).waitFor()
      await p.locator('.modal').evaluate((el) => (el.scrollTop = el.scrollHeight))
      await settle(p)
    },
  },
  { name: 'analytics-dark', theme: 'dark', run: (p) => goTo(p, 'Tahlil va hisobotlar') },
  { name: 'courses-light', theme: 'light', run: (p) => goTo(p, 'Kurslar va xizmatlar') },
  { name: 'admin-light', theme: 'light', run: (p) => goTo(p, 'Boshqaruv') },
  { name: 'admin-dark', theme: 'dark', run: (p) => goTo(p, 'Boshqaruv') },
  { name: 'mobile-light', theme: 'light', width: 390, landing: 'mobile' },
  { name: 'mobile-dark', theme: 'dark', width: 390 },
  {
    name: 'mobile-teacher-dark',
    theme: 'dark',
    width: 390,
    run: async (p) => {
      await p.getByRole('region', { name: 'Demo rejim' }).getByRole('combobox').selectOption({ label: "O'qituvchi" })
      await p.getByRole('button', { name: "O'tkazib yuborish" }).click({ timeout: 8000 }).catch(() => undefined)
      await p.getByRole('navigation', { name: 'Pastki menyu' }).getByRole('button', { name: 'Davomat' }).click()
      await p.locator('.lesson-student').first().waitFor()
      await settle(p)
    },
  },
  { name: 'landing', theme: 'light', landingPage: true },
]

async function main() {
  const external = option('url')
  const server = external ? null : await startPreview()
  const base = (external ?? `http://localhost:${PORT}`).replace(/\/$/, '')
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
  try {
    await mkdir(DOCS, { recursive: true })
    await mkdir(LANDING, { recursive: true })
    const encoder = await (await browser.newContext()).newPage()
    for (const spec of SHOTS) {
      process.stdout.write(`• ${spec.name}\n`)
      await shoot({ browser, encoder, base }, spec)
    }
  } finally {
    await browser.close()
    server?.kill()
  }
  console.log(`\nYozildi (${written.length}):\n${written.map((w) => `  ${w}`).join('\n')}`)
  const heavy = written.filter((w) => /-1440\.webp — /.test(w) && Number(w.split('— ')[1].replace(' KB', '')) > 80)
  if (heavy.length) {
    console.error(`1440 px WebP 80 KB dan katta:\n${heavy.join('\n')}`)
    process.exitCode = 1
  }
}

await main()
