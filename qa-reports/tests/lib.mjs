// Umumiy yordamchilar: demo'ga kirish, rol almashtirish, xatolarni yig'ish
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright')

export const BASE = process.env.BASE || 'http://localhost:4174'
export const SHOTS = process.env.SHOTS || '/home/user/qa/shots'

export async function launch() {
  return chromium.launch()
}

export function attachCollectors(page, bag) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') bag.console.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => bag.pageErrors.push(String(err)))
  page.on('requestfailed', (req) => bag.network.push(`FAILED ${req.url()} ${req.failure()?.errorText}`))
  page.on('response', (res) => {
    if (res.status() >= 400) bag.network.push(`${res.status()} ${res.url()}`)
  })
}

export function newBag() {
  return { console: [], pageErrors: [], network: [] }
}

export async function closeTour(page) {
  for (let i = 0; i < 3; i++) {
    const tour = page.locator('.tour, .tour-card, [data-tour-card], .product-tour')
    if ((await tour.count()) === 0) break
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
  // Har ehtimolga qarshi: "O'tkazib yuborish" / "Yopish"
  const skip = page.getByRole('button', { name: /O'tkazib yuborish|Tushunarli|Yopish|Пропустить/ })
  if (await skip.first().isVisible().catch(() => false)) await skip.first().click().catch(() => {})
}

export async function enterDemo(page, role = 'admin') {
  await page.goto(`${BASE}/app?demo=1`)
  await page.waitForSelector('.demo-bar select', { timeout: 15000 })
  await page.waitForTimeout(400)
  await closeTour(page)
  if (role !== 'admin') await switchRole(page, role)
}

export async function switchRole(page, role) {
  await page.selectOption('.demo-bar select', role)
  await page.waitForTimeout(600)
  await closeTour(page)
}

export async function navItems(page) {
  // Kompyuterda sidebar; telefonda menyu yashirin bo'lishi mumkin — DOM'dan o'qiymiz
  return page.$$eval('.sidebar-nav .nav-item', (els) => els.map((e) => ({ tour: e.getAttribute('data-tour'), label: e.textContent.trim() })))
}

export async function openSection(page, id) {
  const vw = page.viewportSize().width
  const btn = page.locator(`.sidebar-nav .nav-item[data-tour="${id}"]`)
  if (!(await btn.isVisible().catch(() => false))) {
    // Mobil: menyuni ochish
    const menu = page.locator('button[aria-label*="Menyu"], button[aria-label*="menyu"], .menu-toggle, .header-menu').first()
    if (await menu.isVisible().catch(() => false)) await menu.click()
    await page.waitForTimeout(250)
  }
  if (await btn.isVisible().catch(() => false)) await btn.click()
  else await btn.evaluate((el) => el.click())
  await page.waitForTimeout(vw < 500 ? 700 : 500)
  // Lazy chunk yuklanishini kutish
  await page.waitForSelector('.section-loading', { state: 'detached', timeout: 8000 }).catch(() => {})
}

export async function overflowReport(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const vw = doc.clientWidth
    const hScroll = doc.scrollWidth > vw + 1
    const offenders = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const style = getComputedStyle(el)
      if (style.position === 'fixed' && r.right > vw + 1) {
        offenders.push({ el: describe(el), right: Math.round(r.right) })
        continue
      }
      if (r.right > vw + 1) {
        // Scroll qilinadigan konteyner ichidagilar hisobga olinmaydi
        let p = el.parentElement
        let clipped = false
        while (p && p !== document.body) {
          const s = getComputedStyle(p)
          if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) {
            clipped = true
            break
          }
          p = p.parentElement
        }
        if (!clipped) offenders.push({ el: describe(el), right: Math.round(r.right) })
      }
    }
    function describe(el) {
      const cls = typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${el.textContent ? ' "' + el.textContent.trim().slice(0, 30) + '"' : ''}`
    }
    return { vw, scrollWidth: doc.scrollWidth, hScroll, offenders: offenders.slice(0, 8) }
  })
}

export async function smallTargets(page, min = 24) {
  return page.evaluate((min) => {
    const out = []
    for (const el of document.querySelectorAll('button, a[href], input, select, [role="button"], [role="tab"]')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const s = getComputedStyle(el)
      if (s.visibility === 'hidden' || s.display === 'none') continue
      if (el.closest('[aria-hidden="true"]')) continue
      if (r.width < min || r.height < min) {
        out.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 25)}"`)
      }
    }
    return out
  }, min)
}

export async function visibleButtons(page, scope = 'main') {
  return page.$$eval(`${scope} button, ${scope} [role="button"]`, (els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40))
      .filter(Boolean),
  )
}
