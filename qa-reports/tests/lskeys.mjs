import { launch, enterDemo } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext()).newPage()
await enterDemo(p, 'manager')
console.log(await p.evaluate(() => Object.keys(localStorage).map(k => k + ' ' + (localStorage.getItem(k)||'').length)))
console.log(await p.evaluate(() => Object.keys(sessionStorage)))
await b.close()
