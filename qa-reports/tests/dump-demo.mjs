import fs from 'node:fs'
import { launch, enterDemo, openSection, SHOTS } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await enterDemo(p, 'admin')
const data = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('eduflow-demo:')).map(k => [k.slice(13), JSON.parse(localStorage.getItem(k))])))
fs.writeFileSync('/home/user/qa/logs/demo-data.json', JSON.stringify(data))
const ui = {}
ui.cash = await p.locator('.sidebar-balance strong').innerText()
ui.kpi = await p.locator('main').innerText().then(t => t.slice(0, 600))
await openSection(p, 'finance')
await p.waitForTimeout(500)
ui.finance = await p.locator('main').innerText()
await p.screenshot({ path: SHOTS + '/finance-admin-1440.png', fullPage: true })
fs.writeFileSync('/home/user/qa/logs/ui-finance.txt', ui.finance)
console.log(ui.cash, '\n---KPI---\n', ui.kpi, '\n---FIN---\n', ui.finance.slice(0, 2500))
await b.close()
