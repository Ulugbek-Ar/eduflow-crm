import { launch } from './lib.mjs'
const b = await launch(); const p = await (await b.newContext()).newPage()
for (const path of ['privacy', 'terms']) { await p.goto(`https://ulugbek-ar.github.io/eduflow-crm/${path}`); await p.waitForTimeout(800); const t = await p.locator('body').innerText(); console.log(path, (t.match(/\[[^\]]*\]/g) || []).length, (t.match(/\[[^\]]*\]/g) || []).slice(0, 8)) }
await b.close()
