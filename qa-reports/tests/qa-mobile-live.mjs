import fs from 'node:fs'
import { launch, enterDemo, openSection, closeTour, BASE, SHOTS, smallTargets, overflowReport } from './lib.mjs'
const LIVE = 'https://ulugbek-ar.github.io/eduflow-crm'
const R = {}
const b = await launch()
// ===== Jonli sayt: QA-04, QA-15, QA-16, QA-23 (faqat ko'rish) =====
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage()
  const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(String(e)))
  for (const path of ['privacy', 'terms']) {
    const r = await p.goto(`${LIVE}/${path}`); await p.waitForTimeout(800)
    const t = await p.locator('body').innerText()
    R[`live_${path}`] = { status: r.status(), brackets: (t.match(/\[[^\]]{3,60}\]/g) || []).slice(0, 10) }
    await p.screenshot({ path: `${SHOTS}/live-${path}.png` })
  }
  const r404 = await p.goto(`${LIVE}/no-such-page-qa`); await p.waitForTimeout(800)
  R.live_404 = { status: r404.status(), title: await p.title(), h1: await p.locator('h1').first().innerText().catch(() => '') }
  await p.screenshot({ path: `${SHOTS}/live-404.png` })
  // QA-16: RU landing
  await p.goto(`${LIVE}/`); await p.waitForTimeout(800)
  const ruBtn = p.getByRole('button', { name: /^(RU|Ру|Рус)/i }).first()
  if (await ruBtn.isVisible().catch(() => false)) { await ruBtn.click(); await p.waitForTimeout(500) }
  const landing = await p.locator('body').innerText()
  R.live_landing_ru = { hasCyrillic: /[а-яА-Я]{5,}/.test(landing), imgs: await p.locator('img').evaluateAll(els => els.map(e => e.getAttribute('src')).filter(s => s && /\.(jpg|png|webp)/.test(s)).slice(0, 5)), uzStrings: (landing.match(/\b(bepul|o'quvchi|markaz|to'lov)\b/gi) || []).slice(0, 8) }
  await p.screenshot({ path: `${SHOTS}/live-landing-ru.png`, fullPage: true })
  await p.goto(`${LIVE}/privacy`); await p.waitForTimeout(600)
  R.live_privacy_ru = { title: await p.title(), firstLine: (await p.locator('main, body').first().innerText()).slice(0, 120) }
  // QA-23: /owner RU
  await p.goto(`${LIVE}/owner`); await p.waitForTimeout(1000)
  R.live_owner = (await p.locator('body').innerText()).slice(0, 600)
  await p.screenshot({ path: `${SHOTS}/live-owner-ru.png` })
  R.live_errors = errs
  await ctx.close()
}
// ===== Lokal, telefon 390×844: QA-10, QA-12, QA-17 =====
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await ctx.newPage()
  await enterDemo(p, 'admin')
  await openSection(p, 'finance')
  await p.getByRole('button', { name: "To'lov qabul qilish" }).first().click(); await p.waitForTimeout(500)
  const save = p.getByRole('dialog', { name: "To'lov qabul qilish" }).getByRole('button', { name: 'Saqlash' })
  const bb = await save.boundingBox()
  R.qa10 = { saveBox: bb, inViewport: bb ? bb.y + bb.height <= 844 : false }
  await p.screenshot({ path: `${SHOTS}/qa10-mobile-payment-modal.png` })
  await p.getByRole('dialog', { name: "To'lov qabul qilish" }).getByRole('button', { name: 'Yopish' }).click(); await p.waitForTimeout(300)
  await p.setViewportSize({ width: 390, height: 480 })
  await p.getByRole('button', { name: "To'lov qabul qilish" }).first().click(); await p.waitForTimeout(500)
  const bb2 = await p.getByRole('dialog', { name: "To'lov qabul qilish" }).getByRole('button', { name: 'Saqlash' }).boundingBox()
  R.qa10_480 = { saveBox: bb2, inViewport: bb2 ? bb2.y + bb2.height <= 480 : false }
  await p.getByRole('dialog', { name: "To'lov qabul qilish" }).getByRole('button', { name: 'Yopish' }).click(); await p.waitForTimeout(300)
  await p.setViewportSize({ width: 390, height: 844 })
  // QA-12
  await openSection(p, 'admin')
  R.qa12_adminTabs = await p.locator('main [role="tab"]').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return `${e.textContent.trim()}:${r.right <= innerWidth ? 'ko\'rinadi' : 'TASHQARIDA'}` }))
  await p.screenshot({ path: `${SHOTS}/qa12-admin-tabs-390.png` })
  await openSection(p, 'settings')
  R.qa12_settingsNav = await p.locator('.settings-nav a, .settings-nav button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return `${e.textContent.trim()}:${r.right <= innerWidth && r.left >= 0 ? 'ko\'rinadi' : 'TASHQARIDA'}` }))
  await p.screenshot({ path: `${SHOTS}/qa12-settings-nav-390.png` })
  // QA-17
  await openSection(p, 'customers')
  R.qa17_customers = (await smallTargets(p, 32)).slice(0, 15)
  await ctx.close()
}
await b.close()
fs.writeFileSync('/home/user/qa/logs/qa-mobile-live.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1))
