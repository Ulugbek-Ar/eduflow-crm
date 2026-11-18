// Ma'lumot yo'qolishi: refresh, rol almashish, ikki tab, qoralama, sozlamalar
import { launch, enterDemo, openSection, switchRole, closeTour, BASE, SHOTS } from './lib.mjs'
const b = await launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const R = {}
const custCount = () => p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:customers')).length)
await enterDemo(p, 'admin')
// 1. Yangi mijoz qo'shish -> refresh
await openSection(p, 'customers')
await p.getByRole('button', { name: 'Yangi mijoz' }).click(); await p.waitForTimeout(400)
await p.getByLabel(/^Ism familiya/).fill('QA Refresh Test')
await p.getByLabel(/^Telefon/).fill('+998 90 765 43 21')
await p.locator('.modal-overlay').last().getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(500)
const c1 = await custCount()
await p.reload(); await p.waitForSelector('.demo-bar select'); await closeTour(p)
R.afterReload = { mode: await p.evaluate(() => sessionStorage.getItem('eduflow:mode')), stillDemo: await p.locator('.demo-bar').count() > 0, customers: await custCount(), same: c1 === await custCount(), section: await p.locator('.nav-item.is-active').innerText() }
// 2. Rol almashish -> mijoz ko'rinadimi
await switchRole(p, 'manager'); await openSection(p, 'customers')
await p.getByPlaceholder(/Qidir/).first().fill('QA Refresh'); await p.waitForTimeout(500)
R.managerSeesNewCustomer = (await p.locator('main').innerText()).includes('QA Refresh Test')
await switchRole(p, 'admin')
// 3. Qoralama: forma to'ldirilib, sahifa yangilansa
await openSection(p, 'customers')
await p.getByRole('button', { name: 'Yangi mijoz' }).click(); await p.waitForTimeout(300)
await p.getByLabel(/^Ism familiya/).fill('Draft Person')
await p.waitForTimeout(300)
await p.reload(); await p.waitForSelector('.demo-bar select'); await closeTour(p)
await openSection(p, 'customers')
await p.getByRole('button', { name: 'Yangi mijoz' }).click(); await p.waitForTimeout(300)
R.draftRestored = await p.getByLabel(/^Ism familiya/).inputValue()
await p.locator('.modal-overlay').getByRole('button', { name: 'Yopish' }).first().click(); await p.waitForTimeout(300)
// 3b. Qoralama boshqa rolga o'tadimi (bir brauzer, boshqa xodim)
await switchRole(p, 'manager'); await openSection(p, 'customers')
await p.getByRole('button', { name: 'Yangi mijoz' }).click(); await p.waitForTimeout(300)
R.draftLeaksToOtherStaff = await p.getByLabel(/^Ism familiya/).inputValue()
await p.locator('.modal-overlay').getByRole('button', { name: 'Yopish' }).first().click(); await p.waitForTimeout(300)
await switchRole(p, 'admin')
// 4. Ikki tab: A da mijoz qo'shiladi, B (eski holat) da boshqa mijoz qo'shiladi -> ikkalasi qoladimi
const p2 = await ctx.newPage(); await p2.goto(`${BASE}/app`); await p2.waitForSelector('.demo-bar select', { timeout: 10000 }).catch(() => {}); await closeTour(p2)
R.tab2Demo = await p2.locator('.demo-bar').count() > 0
if (R.tab2Demo) {
  await openSection(p, 'customers'); await openSection(p2, 'customers')
  await p.getByRole('button', { name: 'Yangi mijoz' }).click(); await p.waitForTimeout(300)
  await p.getByLabel(/^Ism familiya/).fill('Tab A Person'); await p.getByLabel(/^Telefon/).fill('+998 90 111 11 11')
  await p.locator('.modal-overlay').last().getByRole('button', { name: "Qo'shish" }).click(); await p.waitForTimeout(500)
  await p2.getByRole('button', { name: 'Yangi mijoz' }).click(); await p2.waitForTimeout(300)
  await p2.getByLabel(/^Ism familiya/).fill('Tab B Person'); await p2.getByLabel(/^Telefon/).fill('+998 90 222 22 22')
  await p2.locator('.modal-overlay').last().getByRole('button', { name: "Qo'shish" }).click(); await p2.waitForTimeout(800)
  R.twoTabs = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:customers')).filter(c => c.name.startsWith('Tab ')).map(c => c.name))
}
console.log(JSON.stringify(R, null, 1))
await b.close()
