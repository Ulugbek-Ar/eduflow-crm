import { launch, enterDemo, openSection, SHOTS } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await enterDemo(p, 'admin'); await openSection(p, 'customers')
await p.getByRole('button', { name: 'Yangi mijoz' }).click(); await p.waitForTimeout(500)
const m = p.locator('.modal-overlay').last()
console.log(await m.locator('button').allInnerTexts())
console.log(await m.locator('input,select,textarea').evaluateAll(els => els.map(e => [e.tagName, e.labels?.[0]?.textContent, e.value])))
await p.screenshot({ path: SHOTS + '/customer-form.png' })
await b.close()
