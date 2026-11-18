import { launch, enterDemo, SHOTS } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await enterDemo(p, 'admin')
for (const sel of ['#global-search', '.branch-switch select, header select']) {
  const el = p.locator(sel).first(); const st = () => el.evaluate(e => { const s = getComputedStyle(e); const w = e.closest('.search, .header-search, .branch-switch') || e.parentElement; const ws = getComputedStyle(w); return { border: s.borderColor, outline: s.outlineStyle + ' ' + s.outlineWidth, shadow: s.boxShadow, bg: s.backgroundColor, wrapBorder: ws.borderColor, wrapShadow: ws.boxShadow, wrapOutline: ws.outlineStyle } })
  const before = await st(); await el.focus(); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); const after = await st()
  console.log(sel, '\n before', JSON.stringify(before), '\n after ', JSON.stringify(after))
  await el.screenshot({ path: SHOTS + `/focus-${sel.startsWith('#') ? 'search' : 'branch'}.png` }).catch(() => {})
}
await b.close()
