import { launch, enterDemo, openSection, SHOTS, newBag, attachCollectors } from './lib.mjs'
const b = await launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage()
const bag = newBag(); attachCollectors(p, bag)
await enterDemo(p, 'admin')
await p.waitForTimeout(2500) // prefetch (1.2s) tugashi
await ctx.setOffline(true); await p.waitForTimeout(400)
const R = { banner: (await p.locator('.offline-banner, [class*="offline"]').allInnerTexts()).join(' | ') }
for (const s of ['customers', 'finance', 'teachers', 'schedule', 'admin', 'help', 'settings']) {
  await openSection(p, s); await p.waitForTimeout(800)
  const t = await p.locator('main').innerText()
  R[s] = /xato|Xato|yuklanmadi|Qayta urinish|Yuklanmoqda/.test(t) ? 'ERROR/LOADING: ' + t.slice(0, 120).replace(/\n/g, ' ') : 'OK'
  if (R[s] !== 'OK') await p.screenshot({ path: `${SHOTS}/offline-${s}.png` })
}
// Offline'da mijoz qo'shish
await openSection(p, 'customers')
await p.getByRole('button', { name: 'Yangi mijoz' }).first().click(); await p.waitForTimeout(300)
const d = p.getByRole('dialog', { name: 'Yangi mijoz' }); await d.getByLabel(/Ism familiya/).fill('Offline Person'); await d.getByLabel(/Telefon/).fill('905555555')
await d.getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(400)
R.offlineAddSaved = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:customers')).some(c => c.name === 'Offline Person'))
await ctx.setOffline(false); await p.waitForTimeout(500)
await openSection(p, 'teachers'); await p.waitForTimeout(800)
R.teachersAfterOnline = (await p.locator('main').innerText()).slice(0, 220).replace(/\n/g, ' '); await p.screenshot({ path: SHOTS + '/offline-teachers-after-online.png' }); const btn = p.locator('main button').first(); R.retryBtn = await btn.innerText().catch(()=>''); await btn.click().catch(()=>{}); await p.waitForTimeout(2500); R.afterRetry = (await p.locator('main').innerText()).slice(0, 80).replace(/\n/g, ' '); R.stillDemoAfterRetry = await p.locator('.demo-bar').count() > 0; R.offlineCustomerAfterRetry = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:customers') || '[]').some(c => c.name === 'Offline Person'))
R.errors = { console: bag.console.slice(0, 5), page: bag.pageErrors.slice(0, 3) }
console.log(JSON.stringify(R, null, 1)); await b.close()
