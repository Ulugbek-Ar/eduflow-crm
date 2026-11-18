import { launch, enterDemo, openSection, SHOTS } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await enterDemo(p, 'admin'); await openSection(p, 'finance')
const phone = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:customers'))[0].phone)
const digits = phone.replace(/\D/g, '').slice(3)
await p.getByRole('button', { name: "To'lov qabul qilish" }).first().click(); await p.waitForTimeout(400)
const cb = p.getByRole('dialog', { name: "To'lov qabul qilish" }).getByRole('combobox', { name: 'Mijoz' })
const out = { phone }
for (const q of [digits, phone.slice(5, 11), '+998' + digits, phone]) { await cb.fill(q); await p.waitForTimeout(300); out[q] = await p.locator('.combobox-list li[role="option"]').count() }
await cb.fill(digits); await p.waitForTimeout(300); await p.screenshot({ path: SHOTS + '/qa06-combobox-digits.png' })
console.log(out); await b.close()
