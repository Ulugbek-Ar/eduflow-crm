// Rol × bo'lim × ekran: menyu, tugmalar, konsol/network xatolari, gorizontal siljish, kichik bosish nishonlari
import fs from 'node:fs'
import { launch, enterDemo, navItems, openSection, newBag, attachCollectors, overflowReport, visibleButtons, smallTargets, SHOTS } from './lib.mjs'
const ROLES = ['admin', 'manager', 'cashier', 'viewer', 'teacher']
const SIZES = (process.env.SIZES || '1440,768,390').split(',').map(Number)
const out = {}
const b = await launch()
for (const w of SIZES) {
  for (const role of ROLES) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : w < 1000 ? 1024 : 900 }, ...(w < 500 ? { isMobile: true, hasTouch: true } : {}) })
    const p = await ctx.newPage()
    const bag = newBag(); attachCollectors(p, bag)
    await enterDemo(p, role)
    const nav = await navItems(p)
    const key = `${role}@${w}`
    out[key] = { nav: nav.map((n) => n.tour), sections: {} }
    out[key].cashBalanceVisible = await p.locator('.sidebar-balance').count() > 0
    for (const { tour } of nav) {
      await openSection(p, tour)
      const ov = await overflowReport(p)
      const btns = await visibleButtons(p)
      const text = await p.locator('main').innerText().catch(() => '')
      const phones = (text.match(/\+998[\s\d]{9,}/g) || []).length
      const money = (text.match(/\d[\d\s]* so'm/g) || []).length
      const small = w < 500 ? await smallTargets(p, 24) : []
      out[key].sections[tour] = { hScroll: ov.hScroll, scrollWidth: ov.scrollWidth, offenders: ov.offenders, buttons: [...new Set(btns)].slice(0, 40), phones, money, small: small.slice(0, 15), smallCount: small.length }
      await p.screenshot({ path: `${SHOTS}/roles/${role}-${tour}-${w}.png`, fullPage: false })
    }
    out[key].errors = bag
    await ctx.close()
  }
}
await b.close()
fs.writeFileSync('/home/user/qa/logs/roles.json', JSON.stringify(out, null, 1))
for (const [k, v] of Object.entries(out)) {
  const hs = Object.entries(v.sections).filter(([, s]) => s.hScroll).map(([n]) => n)
  console.log(k.padEnd(14), 'nav=', v.nav.join(','), '| cash=', v.cashBalanceVisible, '| hScroll=', hs.join(',') || '-', '| errs=', v.errors.console.length + v.errors.pageErrors.length, 'net=', v.errors.network.length)
}
