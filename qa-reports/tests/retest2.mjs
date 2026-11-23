import { launch, enterDemo, openSection, switchRole, SHOTS } from './lib.mjs'
const R = {}; const b = await launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage()
const closeAll = async () => { for (let i = 0; i < 4 && await p.locator('.modal-overlay').count(); i++) { await p.locator('.modal-overlay').last().getByRole('button', { name: /Yopish|Bekor qilish/ }).first().click().catch(() => {}); await p.waitForTimeout(250) } }
await enterDemo(p, 'admin'); await openSection(p, 'customers')
R.qa01 = {}
for (const v of ['8 93 111 22 33', '0931112233', '8-90-123-45-67', '998931112233123']) {
  await p.getByRole('button', { name: 'Yangi mijoz' }).first().click(); await p.waitForTimeout(250)
  const d = p.getByRole('dialog', { name: 'Yangi mijoz' }); const ph = d.getByLabel(/Telefon/); await ph.fill(''); await ph.pressSequentially(v, { delay: 5 })
  await d.getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(200)
  R.qa01[v] = [await ph.inputValue().catch(() => 'saved'), (await d.locator('.field-error').allInnerTexts().catch(() => [])).join('|')].join(' / ')
  await closeAll(); await p.evaluate(() => Object.keys(localStorage).filter(k => k.includes('draft')).forEach(k => localStorage.removeItem(k)))
}
await p.getByRole('button', { name: 'Yangi mijoz' }).first().click(); await p.waitForTimeout(250)
{ const d = p.getByRole('dialog', { name: 'Yangi mijoz' }); await d.getByLabel(/Ism familiya/).fill('Gʻulom Qoʻchqorov'); await d.getByLabel(/Telefon/).fill('931112299'); await d.getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(400) }
R.qa02 = {}; for (const q of ["G'ulom", 'G‘ulom', "qo'chqorov", 'gulom']) { await p.locator('#global-search').fill(q); await p.waitForTimeout(350); R.qa02[q] = (await p.locator('main').innerText()).includes('Qoʻchqorov') }
await p.locator('#global-search').fill('')
// QA-03
await openSection(p, 'finance'); await p.getByRole('button', { name: "To'lov qabul qilish" }).first().click(); await p.waitForTimeout(400)
const pay = p.getByRole('dialog', { name: "To'lov qabul qilish" }); const n0 = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:transactions')).length)
await pay.getByLabel(/Summa/).fill('650000'); await pay.getByRole('button', { name: 'Saqlash' }).click(); await p.waitForTimeout(400)
R.qa03 = { saved: (await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:transactions')).length)) > n0, msg: (await p.locator('.modal-overlay').last().innerText().catch(() => '')).split('\n').filter(l => /mijoz|Mijoz/.test(l)).slice(0, 3) }
R.qa22_status = await pay.getByLabel('Status').count().catch(() => 0)
await closeAll()
// A-01: ko'chirish (noyabr to'lagan, qarzsiz faol o'quvchi dinamik tanlanadi)
const pick = await p.evaluate(() => { const g = id => JSON.parse(localStorage.getItem('eduflow-demo:' + id)); const tx = g('transactions'), en = g('enrollments'), gr = g('groups'), cu = g('customers'); const ym = new Date().toISOString().slice(0, 7)
  for (const e of en.filter(e => e.status === 'active' && e.startDate < ym + '-01')) { if (tx.some(t => t.enrollmentId === e.id && t.status === 'paid' && t.period === ym)) { const g0 = gr.find(x => x.id === e.groupId); const other = gr.find(x => x.id !== g0.id && x.courseId === g0.courseId && x.status === 'active'); if (other) return { name: cu.find(c => c.id === e.customerId).name, from: g0.name, to: other.name } } } })
R.a01_pick = pick
const debtTotal = async () => { await openSection(p, 'overview'); await openSection(p, 'finance'); const t = await p.locator('main').innerText(); return (t.match(/(\d+) ta qarzdor, jami ([\d\s]+so'm)/) || []).slice(1).join(' / ') + (t.includes(pick.name) && t.slice(t.indexOf('Qarzdorliklar')).includes(pick.name) ? ` | ${pick.name} qarzdorlar ro'yxatida` : '') }
if (pick) {
  R.a01_before = await debtTotal()
  await openSection(p, 'groups'); await p.locator('main').getByRole('button', { name: pick.from }).first().click(); await p.waitForTimeout(700)
  await p.getByRole('button', { name: `Ko'chirish: ${pick.name}` }).click(); await p.waitForTimeout(400)
  const dlg = p.locator('.modal-overlay').last(); const opt = await dlg.locator('select option').evaluateAll((os, to) => os.find(o => o.textContent.startsWith(to)).value, pick.to)
  await dlg.locator('select').selectOption(opt); const di = dlg.locator('input:not([type="date"])').first(); await di.fill(new Date(Date.now() - 6 * 864e5).toLocaleDateString('ru-RU')); await di.press('Tab')
  await dlg.getByRole('button', { name: 'Saqlash' }).click(); await p.waitForTimeout(500); await closeAll()
  R.a01_after = await debtTotal()
}
// QA-09 o'qituvchi
await switchRole(p, 'teacher'); const t = await p.locator('main').innerText()
R.qa09 = { students: (t.match(/O'quvchilar\n(\d+)/) || [])[1], lessons: (t.match(/(\d+) o'quvchi/g) || []).join(','), periodBar: await p.getByRole('button', { name: 'Shu yil' }).count() }
await ctx.close()
// QA-10 telefon
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
await enterDemo(m, 'admin'); await openSection(m, 'finance'); await m.getByRole('button', { name: "To'lov qabul qilish" }).first().click(); await m.waitForTimeout(500)
const bb = await m.getByRole('dialog', { name: "To'lov qabul qilish" }).getByRole('button', { name: 'Saqlash' }).boundingBox(); R.qa10 = { y: Math.round(bb.y), visible: bb.y + bb.height <= 844 }
await m.screenshot({ path: SHOTS + '/re2-qa10.png' })
await b.close(); console.log(JSON.stringify(R))
