import { launch } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)))
for (const path of ['privacy', 'terms', 'app/?demo=1']) { const r = await p.goto(`https://ulugbek-ar.github.io/eduflow-crm/${path}`); await p.waitForTimeout(1200); const t = await p.locator('body').innerText(); console.log(path, r.status(), 'brackets=' + (t.match(/\[[^\]]*\]/g) || []).length, 'namuna=' + /namuna|образец/i.test(t), '|', t.split('\n').find(l => /egasi|Kompaniya|STIR|rekvizit/i.test(l))?.slice(0, 110) ?? '') }
console.log('pageErrors', errs.length); await b.close()
