import fs from 'node:fs'
import { launch, closeTour, openSection, BASE, SHOTS, newBag, attachCollectors } from './lib.mjs'
const b = await launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage(); const bag = newBag(); attachCollectors(p, bag)
const R = {}
await p.goto(`${BASE}/app`); await p.waitForTimeout(800)
// QA-07: bo'sh forma
await p.getByRole('button', { name: 'Hisob yaratish' }).click(); await p.waitForTimeout(300)
R.qa07_emptyErrors = await p.locator('.field-error, [role="alert"], .input-error, .error').allInnerTexts()
await p.screenshot({ path: SHOTS + '/qa07-empty.png' })
await p.getByLabel(/O'quv markazi nomi/).fill('QA Markaz')
await p.getByLabel(/Ism familiyangiz/).fill('Q')
await p.getByLabel(/^Login/).fill('ab')
await p.locator('input[name="password"]').fill('qisqa')
await p.locator('input[name="confirm"]').fill('boshqa')
await p.getByRole('button', { name: 'Hisob yaratish' }).click(); await p.waitForTimeout(300)
R.qa07_shortErrors = await p.locator('.field-error, [role="alert"], .input-error, .error').allInnerTexts()
await p.screenshot({ path: SHOTS + '/qa07-short.png' })
// XSS: markaz nomi va ism
await p.getByLabel(/O'quv markazi nomi/).fill('<img src=x onerror="window.__xss=1">QA')
await p.getByLabel(/Ism familiyangiz/).fill('Dilshod <b>QA</b>')
await p.getByLabel(/^Login/).fill('direktor')
await p.locator('input[name="password"]').fill('Toshkent2026')
await p.locator('input[name="confirm"]').fill('Toshkent2026')
await p.getByRole('button', { name: 'Hisob yaratish' }).click(); await p.waitForTimeout(800)
// QA-05: ustaning 1-qadami
const step1 = await p.locator('main, .wizard, body').first().evaluate(() => [...document.querySelectorAll('input, textarea')].map(e => [e.labels?.[0]?.textContent?.trim(), e.value, e.placeholder]))
R.qa05_step1 = step1
await p.screenshot({ path: SHOTS + '/qa05-wizard-step1.png' })
await p.getByRole('button', { name: 'Keyingi' }).click(); await p.waitForTimeout(400)
await p.screenshot({ path: SHOTS + '/qa18-wizard-step2.png' })
await p.getByRole('button', { name: 'Ingliz tili' }).click()
await p.getByLabel('Oylik narx').fill('650000')
await p.getByRole('button', { name: "Qo'shish" }).click()
await p.getByRole('button', { name: 'Keyingi' }).click(); await p.waitForTimeout(400)
// QA-18: rol tanlovi kesilganmi
R.qa18_roleSelect = await p.locator('select').evaluateAll(els => els.map(e => ({ w: e.clientWidth, sw: e.scrollWidth, val: e.options[e.selectedIndex]?.text })))
await p.screenshot({ path: SHOTS + '/qa18-wizard-step3.png' })
await p.getByRole('button', { name: "O'tkazib yuborish" }).click()
await p.getByRole('button', { name: 'Boshlash' }).click(); await p.waitForTimeout(800)
await closeTour(p)
R.xss = await p.evaluate(() => window.__xss ?? null)
R.orgNameRendered = await p.locator('.sidebar-logo-text strong').innerText()
// QA-08: Boshlash qadamlari
R.qa08_gettingStarted = await p.locator('main').innerText().then(t => t.slice(0, 900))
await p.screenshot({ path: SHOTS + '/qa08-getting-started.png', fullPage: true })
// Settings: phone/address real values (QA-05 oqibati)
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('apex:settings')))
R.qa05_settings = { phone: st.phone, address: st.address, orgName: st.orgName }
// Ikki tab bir vaqtda
await openSection(p, 'customers')
const p2 = await ctx.newPage(); await p2.goto(`${BASE}/app`); await p2.waitForTimeout(1000); await closeTour(p2)
R.tab2LoggedIn = await p2.locator('.sidebar-nav').count() > 0
if (R.tab2LoggedIn) {
  await openSection(p2, 'customers')
  for (const [pg, name, ph] of [[p, 'Tab A Person', '901111111'], [p2, 'Tab B Person', '902222222']]) {
    await pg.getByRole('button', { name: 'Yangi mijoz' }).first().click(); await pg.waitForTimeout(300)
    const d = pg.getByRole('dialog', { name: 'Yangi mijoz' })
    await d.getByLabel(/Ism familiya/).fill(name); await d.getByLabel(/Telefon/).fill(ph)
    await d.getByRole('button', { name: "Qo'shish" }).click(); await pg.waitForTimeout(600)
  }
  R.twoTabs = await p.evaluate(() => JSON.parse(localStorage.getItem('apex:customers')).map(c => c.name))
  R.tabAseesB = (await p.locator('main').innerText()).includes('Tab B Person')
}
R.errors = bag
console.log(JSON.stringify(R, null, 1))
fs.writeFileSync('/home/user/qa/logs/local-onboarding.json', JSON.stringify(R, null, 1))
await b.close()
