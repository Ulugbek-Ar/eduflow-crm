import fs from 'node:fs'
async function closeModal(p){ for(let i=0;i<3 && await p.locator('.modal-overlay').count();i++){ await p.locator('.modal-overlay').last().getByRole('button',{name:'Yopish'}).first().click().catch(()=>{}); await p.waitForTimeout(300)} }
import { launch, enterDemo, openSection, newBag, attachCollectors, visibleButtons, SHOTS } from './lib.mjs'
const ROLES = ['admin', 'manager', 'cashier', 'viewer', 'teacher']
const out = {}
const b = await launch()
for (const role of ROLES) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage(); const bag = newBag(); attachCollectors(p, bag)
  await enterDemo(p, role)
  const r = (out[role] = {})
  r.header = [...new Set(await visibleButtons(p, 'header'))]
  // "Qo'shish" menyusi
  const add = p.getByRole('button', { name: /Qo'shish/ }).first()
  if (await add.isVisible().catch(() => false)) { await add.click(); await p.waitForTimeout(300); r.addMenu = await p.$$eval('[role="menu"] [role="menuitem"], .dropdown-menu button, .menu button', els => els.map(e => e.textContent.trim().replace(/\s+/g,' ').slice(0,40))); await p.keyboard.press('Escape') }
  // Mijoz kartasi
  if (role !== 'teacher') {
    await openSection(p, 'customers')
    const card = p.locator('button[aria-label$="kartasi"]').first()
    if (await card.count()) { await card.click(); await p.waitForTimeout(700); r.customerModal = [...new Set(await visibleButtons(p, '.modal-overlay'))]; r.customerModalText = (await p.locator('.modal-overlay').last().innerText().catch(()=>'')).slice(0, 400); await p.screenshot({ path: `${SHOTS}/roles/modal-customer-${role}.png` }); await closeModal(p) }
  }
  // Guruh kartasi
  await openSection(p, 'groups')
  const g = p.locator('main').getByRole('button', { name: /IELTS — ertalabki/ }).first()
  if (await g.count()) { await g.click(); await p.waitForTimeout(800); r.groupModal = [...new Set(await visibleButtons(p, '.modal-overlay'))]; const t = await p.locator('.modal-overlay').last().innerText().catch(()=>''); r.groupPhones = (t.match(/\+998[\s\d]{9,}/g)||[]).length; r.groupMoney = (t.match(/\d[\d\s]* so'm/g)||[]).slice(0,5); await p.screenshot({ path: `${SHOTS}/roles/modal-group-${role}.png` }); await closeModal(p) }
  // Kalit "n" (yangi mijoz)
  await openSection(p, 'overview')
  await p.locator('body').press('n'); await p.waitForTimeout(400)
  r.keyN_opensModal = await p.locator('.modal').count() > 0
  await p.keyboard.press('Escape')
  r.errors = bag
  await ctx.close()
}
await b.close()
fs.writeFileSync('/home/user/qa/logs/roles-modals.json', JSON.stringify(out, null, 1))
for (const [k, v] of Object.entries(out)) console.log('\n==', k, JSON.stringify({ header: v.header, addMenu: v.addMenu, customerModal: v.customerModal, groupModal: v.groupModal, groupPhones: v.groupPhones, groupMoney: v.groupMoney, keyN: v.keyN_opensModal, errs: v.errors.console.length + v.errors.pageErrors.length }))
