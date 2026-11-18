import { launch, enterDemo, openSection, SHOTS } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })).newPage()
await enterDemo(p, 'admin')
const t = p.getByRole('button', { name: /Qorong'i mavzuga/ }); if (await t.count()) await t.click(); await p.waitForTimeout(300)
console.log('theme attr', await p.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor]))
await p.screenshot({ path: SHOTS + '/dark-overview.png' })
// Klaviatura: Tab 15 marta — fokus ko'rinadimi
await p.locator('body').click({ position: { x: 700, y: 5 } })
const seq = []
for (let i = 0; i < 18; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return `${a.tagName}${a.className ? '.' + String(a.className).split(' ')[0] : ''} "${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 20)}" outline=${s.outlineStyle !== 'none' && s.outlineWidth !== '0px' ? s.outlineWidth : 'none'} shadow=${s.boxShadow !== 'none'}` })) }
console.log(seq.join('\n'))
// Enter bilan bo'lim ochish
await p.keyboard.press('Enter'); await p.waitForTimeout(400); console.log('after Enter heading:', await p.locator('h1').first().innerText())
await b.close()
