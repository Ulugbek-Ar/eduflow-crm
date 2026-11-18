import { launch, enterDemo, openSection, SHOTS } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
for (const role of ['admin', 'viewer']) {
  await enterDemo(p, role)
  await openSection(p, 'customers')
  await p.locator('button[aria-label$="kartasi"]').first().click(); await p.waitForTimeout(800)
  const ae = await p.evaluate(() => { const a = document.activeElement; return { tag: a.tagName, cls: a.className, label: a.getAttribute('aria-label'), inModal: !!a.closest('.modal-overlay') } })
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  console.log(role, 'activeElement after open:', ae, '| modal still open after Escape:', await p.locator('.modal-overlay').count() > 0)
  if (await p.locator('.modal-overlay').count()) await p.getByRole('button', { name: 'Yopish' }).last().click()
  await p.getByRole('button', { name: /Demo'dan chiqish/ }).click().catch(()=>{}); await p.waitForTimeout(500)
}
await b.close()
