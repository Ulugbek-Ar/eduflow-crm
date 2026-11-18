// QA-01…QA-23 brauzerda qayta sinash (lokal build, demo)
import fs from 'node:fs'
import { launch, enterDemo, openSection, switchRole, closeTour, BASE, SHOTS, smallTargets } from './lib.mjs'
const R = {}
const b = await launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage()
await enterDemo(p, 'admin')
// QA-01 telefon
await openSection(p, 'customers')
R.qa01 = {}
for (const v of ['8 93 111 22 33', '0931112233', '8-90-123-45-67', '93 111 22 33']) {
  await p.getByRole('button', { name: 'Yangi mijoz' }).first().click(); await p.waitForTimeout(250)
  const d = p.getByRole('dialog', { name: 'Yangi mijoz' }); const ph = d.getByLabel(/Telefon/)
  await ph.fill(''); await ph.pressSequentially(v, { delay: 5 }); R.qa01[v] = await ph.inputValue()
  await d.getByRole('button', { name: 'Yopish' }).click(); await p.waitForTimeout(200)
  // qoralamani tozalash
  await p.evaluate(() => Object.keys(localStorage).filter(k => k.includes('draft')).forEach(k => localStorage.removeItem(k)))
}
// QA-02 qidiruv: Gʻulom (U+02BB) qo'shish
await p.getByRole('button', { name: 'Yangi mijoz' }).first().click(); await p.waitForTimeout(250)
{ const d = p.getByRole('dialog', { name: 'Yangi mijoz' }); await d.getByLabel(/Ism familiya/).fill('Gʻulom Qoʻchqorov'); await d.getByLabel(/Telefon/).fill('931112233'); await d.getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(500) }
R.qa02 = {}
const search = p.locator('#global-search')
for (const q of ["G'ulom", 'G‘ulom', "qo'chqorov", 'gulom', 'Gʻulom']) {
  await search.fill(q); await p.waitForTimeout(400)
  R.qa02[q] = (await p.locator('main').innerText()).includes('Qoʻchqorov')
}
await search.fill('')
// QA-06 Combobox telefon raqami bo'sh joysiz
await openSection(p, 'finance')
await p.getByRole('button', { name: "To'lov qabul qilish" }).first().click(); await p.waitForTimeout(400)
const pay = p.getByRole('dialog', { name: "To'lov qabul qilish" })
R.qa06 = {}
for (const q of ['931112233', '93 111', '+998931112233']) { await pay.getByRole('combobox', { name: 'Mijoz' }).fill(q); await p.waitForTimeout(300); R.qa06[q] = await p.getByRole('option').count() }
await pay.getByRole('combobox', { name: 'Mijoz' }).fill('')
// QA-22 Status tanlovi, QA-03 mijozsiz kurs to'lovi
R.qa22_statusField = await pay.getByLabel('Status').count() > 0
const before = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:transactions')).length)
await pay.getByLabel(/Summa/).fill('650000')
await pay.getByRole('button', { name: 'Saqlash' }).click(); await p.waitForTimeout(500)
const txs = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:transactions')))
R.qa03 = { saved: txs.length > before, newTx: txs.length > before ? { category: txs[0].category, customerId: txs[0].customerId ?? null, amount: txs[0].amount } : null }
// QA-21 chek: shu (mijozsiz) to'lov va onlayn to'lov
await p.waitForTimeout(300)
// QA-14 xodimlar ro'yxatida filial ustuni
await openSection(p, 'admin')
R.qa14_headers = await p.locator('main th').allInnerTexts()
// QA-15 noma'lum URL (lokal preview)
const r404 = await (await ctx.newPage()).goto(`${BASE}/no-such-page`); R.qa15_local = { status: r404.status() }
// QA-09 o'qituvchi
await switchRole(p, 'teacher')
const t0 = await p.locator('main').innerText()
R.qa09 = { text: t0.slice(0, 400) }
const kpiBefore = await p.locator('main .kpi, main .stat, main .card').first().innerText().catch(() => '')
await p.getByRole('button', { name: 'Shu yil' }).click().catch(() => {}); await p.waitForTimeout(300)
R.qa09.periodChangesSomething = (await p.locator('main').innerText()) !== t0
// QA-19: o'qituvchiga narx, ikki tanlov
await openSection(p, 'attendance')
R.qa19_attendanceSelectors = { segmentButtons: await p.locator('main .segmented button').count(), lessonSelect: await p.locator('main select').count() }
R.qa19_branchSwitchForTeacher = await p.locator('header select, .branch-switch').count()
// QA-20 profil aria-label
await switchRole(p, 'admin')
R.qa20_profile = await p.locator('header button[aria-label^="Profil"]').evaluate(e => ({ aria: e.getAttribute('aria-label'), text: e.innerText.replace(/\s+/g, ' ') }))
await openSection(p, 'finance')
R.qa20_receiptBtnLabels = [...new Set(await p.locator('main').getByRole('button', { name: /^Chek/ }).evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.textContent.trim())))].slice(0, 3)
// QA-21: chek — onlayn yoki mijozsiz to'lov
await p.locator('main').getByRole('button', { name: /^Chek/ }).first().click(); await p.waitForTimeout(500)
R.qa21_receipt = (await p.locator('.modal-overlay').last().innerText()).split('\n').filter(l => /Qabul qildi|Qarz/.test(l))
await p.locator('.modal-overlay').last().getByRole('button', { name: 'Yopish' }).first().click().catch(() => {})
await b.close()
fs.writeFileSync('/home/user/qa/logs/qa-retest.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1))
