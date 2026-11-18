import { launch, enterDemo, navItems, newBag, attachCollectors, SHOTS } from './lib.mjs'
const b = await launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage()
const bag = newBag(); attachCollectors(p, bag)
await enterDemo(p)
console.log(await navItems(p))
console.log(await p.$$eval('[class*="tour"]', els => els.map(e => e.className)))
await p.screenshot({ path: SHOTS + '/probe.png' })
console.log(bag)
await b.close()
