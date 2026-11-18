import { launch, enterDemo, openSection, SHOTS } from './lib.mjs'
const CSV = [
  'Ism;Telefon;Kurs;Izoh',
  '<img src=x onerror=window.__xss=1>;901112201;IELTS;xss',
  '=HYPERLINK("http://evil");901112202;IELTS;formula',
  'Sakkiz Bilan;8 93 111 22 03;IELTS;8-prefiks',
  'Nol Bilan;0931112204;IELTS;0-prefiks',
  ';901112205;IELTS;bo\'sh ism',
  'Qisqa Tel;12345;IELTS;qisqa',
  'Gʻulom Import;901112207;Yangi Kurs QA;yangi kurs',
].join('\r\n')
const b = await launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage()
await enterDemo(p, 'admin'); await openSection(p, 'customers')
await p.getByRole('button', { name: 'Import', exact: true }).click(); await p.waitForTimeout(400)
const d = p.getByRole('dialog', { name: 'Mijozlarni import qilish' })
await d.locator('input[type="file"]').setInputFiles({ name: 'edge.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿' + CSV, 'utf8') }); await p.waitForTimeout(800)
console.log('STATUS:', await d.getByRole('status').first().innerText().catch(() => '-'))
console.log('ISSUES:', (await d.innerText()).split('\n').filter(l => /qator|Telefon|Ism|takror|bor/i.test(l)).slice(0, 14).join(' | '))
await p.screenshot({ path: SHOTS + '/import-edge-preview.png', fullPage: true })
const btn = d.getByRole('button', { name: /^Import qilish/ }); if (await btn.count()) { await btn.click(); await p.waitForTimeout(800) }
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:customers')).filter(c => /xss|HYPERLINK|Sakkiz|Nol Bilan|Qisqa|Import|img/.test(c.name + c.note)).map(c => `${c.name} | ${c.phone} | ${c.course}`))
console.log('SAVED:', saved, '| xss fired:', await p.evaluate(() => window.__xss ?? null))
const courses = await p.evaluate(() => JSON.parse(localStorage.getItem('eduflow-demo:courses')).map(c => c.name))
console.log('COURSES:', courses)
await b.close()
