// Modullar: forma validatsiyasi, qidiruv, filtr, saralash, pagination, eksport
import fs from 'node:fs'
import { launch, enterDemo, openSection, SHOTS, newBag, attachCollectors } from './lib.mjs'
const R = {}
const b = await launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage()
const bag = newBag(); attachCollectors(p, bag)
await enterDemo(p, 'admin')
const errs = async (dlg) => (await dlg.locator('.field-error, .input-error, [id$="-error"], .error-text').allInnerTexts()).filter(Boolean)
const dlgOf = (name) => p.getByRole('dialog', { name })
const close = async () => { for (let i = 0; i < 3 && await p.locator('.modal-overlay').count(); i++) { await p.locator('.modal-overlay').last().getByRole('button', { name: 'Yopish' }).first().click().catch(() => {}); await p.waitForTimeout(250) } }
// --- Mijozlar: validatsiya
await openSection(p, 'customers')
await p.getByRole('button', { name: 'Yangi mijoz' }).first().click(); await p.waitForTimeout(300)
let d = dlgOf('Yangi mijoz')
await d.getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(200)
R.customer_empty = await errs(d)
await d.getByLabel(/Ism familiya/).fill('   '); await d.getByLabel(/Telefon/).fill('90123'); await d.getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(200)
R.customer_spaces_shortphone = await errs(d)
// takroriy telefon
const existing = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:customers'))[0])
await d.getByLabel(/Ism familiya/).fill('Dup Test'); await d.getByLabel(/Telefon/).fill(existing.phone); await p.waitForTimeout(300)
R.customer_duplicate_phone_ui = (await d.innerText()).split('\n').filter(l => /mavjud|takror|bazada/i.test(l))
// juda uzun ism
await d.getByLabel(/Ism familiya/).fill('A'.repeat(300)); await d.getByLabel(/Telefon/).fill('909998877'); await d.getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(300)
R.customer_300chars = { errors: await errs(d), saved: await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:customers')).some(c => c.name.length >= 300)) }
await close()
// --- qidiruv / filtr / saralash / pagination
const gs = p.locator('#global-search')
await gs.fill('Aziza'); await p.waitForTimeout(400); R.search_aziza_rows = await p.locator('main tbody tr').count(); await gs.fill('')
await gs.fill('zzzzqqq'); await p.waitForTimeout(400); R.search_none = (await p.locator('main').innerText()).match(/topilmadi|Hech narsa|yo'q/i)?.[0] ?? 'EMPTY-STATE?'; await gs.fill('')
await gs.fill('Python 1'); await p.waitForTimeout(400); R.search_python1_rows = (await p.locator('main').innerText()).match(/(\d+)\s*ta/)?.[0]; await gs.fill('')
const firstNames = async () => (await p.locator('main tbody tr td:nth-child(2)').allInnerTexts()).slice(0, 4).map(s => s.split('\n')[0])
await p.locator('main th').getByRole('button', { name: 'Ism' }).click(); await p.waitForTimeout(300); R.sort_name_asc = await firstNames()
await p.locator('main th').getByRole('button', { name: 'Ism' }).click(); await p.waitForTimeout(300); R.sort_name_desc = await firstNames()
R.pagination_info = (await p.locator('main').innerText()).match(/\d+–\d+ \/ \d+/)?.[0]
await p.getByRole('button', { name: 'Keyingi sahifa' }).first().click(); await p.waitForTimeout(300)
R.pagination_page2 = (await p.locator('main').innerText()).match(/\d+–\d+ \/ \d+/)?.[0]
// --- Kurs: validatsiya
await openSection(p, 'courses')
const addCourse = p.locator('main').getByRole('button', { name: /Yangi kurs|Kurs qo'shish/ }).first()
R.course_add_btn = await addCourse.count()
if (R.course_add_btn) {
  await addCourse.click(); await p.waitForTimeout(300); d = p.locator('.modal-overlay').last()
  await d.getByRole('button', { name: /Qo'shish|Saqlash/ }).last().click(); await p.waitForTimeout(200); R.course_empty = await errs(d)
  const price = d.getByLabel(/narx/i).first(); await d.getByLabel(/^Nomi|Kurs nomi/).first().fill('QA kurs'); await price.fill('-5000'); R.course_negative_price_value = await price.inputValue()
  await d.getByRole('button', { name: /Qo'shish|Saqlash/ }).last().click(); await p.waitForTimeout(200); R.course_negative = await errs(d)
  await close()
}
// --- Guruh: validatsiya (tugash vaqti boshlanishdan oldin, sig'im 0)
await openSection(p, 'groups')
await p.locator('main').getByRole('button', { name: 'Yangi guruh' }).click(); await p.waitForTimeout(400); d = p.locator('.modal-overlay').last()
R.group_buttons = await d.locator('button').allInnerTexts(); await d.locator('button[type="submit"], .modal-actions button').last().click(); await p.waitForTimeout(200); R.group_empty = await errs(d)
R.group_fields = await d.locator('input,select').evaluateAll(els => els.map(e => (e.labels?.[0]?.textContent || e.getAttribute('aria-label') || e.type).trim()).filter(Boolean))
await p.screenshot({ path: SHOTS + '/group-form-empty.png' })
await close()
// --- Eksport (Header "Hisobot yuklash")
await p.getByRole('button', { name: 'Hisobot yuklash' }).click(); await p.waitForTimeout(300)
R.export_menu = await p.locator('[role="menu"] [role="menuitem"], .dropdown-menu button').allInnerTexts()
const item = p.locator('[role="menu"] [role="menuitem"]').first()
if (await item.count()) { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), item.click()]); if (dl) { const path = '/home/user/qa/logs/export-' + dl.suggestedFilename(); await dl.saveAs(path); const txt = fs.readFileSync(path, 'utf8'); R.export_file = { name: dl.suggestedFilename(), bytes: txt.length, head: txt.slice(0, 160), bom: txt.charCodeAt(0) === 0xfeff } } }
R.errors = { console: bag.console.slice(0, 5), page: bag.pageErrors }
fs.writeFileSync('/home/user/qa/logs/modules.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1))
await b.close()
