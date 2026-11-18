import fs from 'node:fs'
import { createRequire } from 'node:module'
import { launch, enterDemo, openSection, BASE, SHOTS } from './lib.mjs'
const require = createRequire(import.meta.url)
const { AxeBuilder } = require('@axe-core/playwright')
const R = {}
const b = await launch()
for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme }); const p = await ctx.newPage()
  // landing
  await p.goto(`${BASE}/`); await p.waitForTimeout(800)
  const scan = async (key) => { const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); R[`${scheme}:${key}`] = r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 2).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ').slice(0, 140)) })) }
  await scan('landing')
  await enterDemo(p, 'admin')
  // tema: ilova o'z sozlamasini ishlatadi — dark uchun toggle
  if (scheme === 'dark') { const t = p.getByRole('button', { name: /Qorong'i mavzuga/ }); if (await t.count()) await t.click(); await p.waitForTimeout(300) }
  for (const s of ['overview', 'customers', 'groups', 'schedule', 'finance', 'courses', 'teachers', 'analytics', 'admin', 'settings']) { await openSection(p, s); await p.waitForTimeout(400); await scan(s) }
  await openSection(p, 'customers'); await p.getByRole('button', { name: 'Yangi mijoz' }).first().click(); await p.waitForTimeout(400); await scan('customer-form')
  await ctx.close()
}
await b.close()
fs.writeFileSync('/home/user/qa/logs/axe.json', JSON.stringify(R, null, 1))
for (const [k, v] of Object.entries(R)) console.log(k.padEnd(22), v.length ? v.map(x => `${x.id}(${x.impact},${x.n})`).join(' ') : '0 violations')
