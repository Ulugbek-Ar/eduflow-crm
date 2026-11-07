import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = new URL('../scripts/spa-routes.mjs', import.meta.url).pathname

const INDEX = `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EduFlow CRM</title>
    <meta property="og:type" content="website" />
    <meta property="og:title" content="EduFlow CRM — o'quv markazlari uchun CRM" />
  </head>
  <body><div id="root"></div></body>
</html>`

function run(args: string[], env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'spa-'))
  writeFileSync(join(dir, 'index.html'), INDEX)
  writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n')
  execFileSync('node', [script, '--out', dir, ...args], { env: { PATH: process.env.PATH ?? '', ...env }, stdio: 'pipe' })
  return (path: string) => readFileSync(join(dir, path), 'utf8')
}

describe('scripts/spa-routes.mjs', () => {
  it('Pages: har sahifa uchun index.html — sarlavha, canonical, og:url; /app va /owner noindex', () => {
    const read = run(['--base', '/eduflow-crm/', '--pages'], { VITE_SITE_URL: 'https://ulugbek-ar.github.io/eduflow-crm/' })
    const app = read('app/index.html')
    expect(app).toContain('<title>Kirish · EduFlow CRM</title>')
    expect(app).toContain('<meta name="robots" content="noindex" />')
    expect(app).toContain('<link rel="canonical" href="https://ulugbek-ar.github.io/eduflow-crm/app/" />')
    expect(app).toContain('<meta property="og:url" content="https://ulugbek-ar.github.io/eduflow-crm/app/" />')
    expect(read('owner/index.html')).toContain('noindex')
    const privacy = read('privacy/index.html')
    expect(privacy).toContain('<title>Maxfiylik siyosati · EduFlow CRM</title>')
    expect(privacy).not.toContain('noindex')
    expect(read('terms/index.html')).toContain('href="https://ulugbek-ar.github.io/eduflow-crm/terms/"')
    expect(read('404.html')).toBe(INDEX)
    const sitemap = read('sitemap.xml')
    expect(sitemap).toContain('<loc>https://ulugbek-ar.github.io/eduflow-crm/</loc>')
    expect(sitemap).toContain('<loc>https://ulugbek-ar.github.io/eduflow-crm/privacy/</loc>')
    expect(sitemap).not.toContain('/app')
    // Pastki papkada robots.txt ishlamaydi — unga sitemap qo'shilmaydi
    expect(read('robots.txt')).not.toContain('Sitemap:')
  })

  it('Vercel (ildiz): manzillar "/" siz, robots.txt ga Sitemap qatori qo\'shiladi', () => {
    const read = run([], { VERCEL_PROJECT_PRODUCTION_URL: 'eduflow.uz' })
    expect(read('privacy/index.html')).toContain('<link rel="canonical" href="https://eduflow.uz/privacy" />')
    expect(read('sitemap.xml')).toContain('<loc>https://eduflow.uz/terms</loc>')
    expect(read('robots.txt')).toContain('Sitemap: https://eduflow.uz/sitemap.xml')
  })

  it('sayt manzili berilmasa: nisbiy canonical (base bilan), sitemap yozilmaydi', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spa-'))
    writeFileSync(join(dir, 'index.html'), INDEX)
    execFileSync('node', [script, '--out', dir, '--base', '/demo'], { env: { PATH: process.env.PATH ?? '' }, stdio: 'pipe' })
    expect(readFileSync(join(dir, 'terms/index.html'), 'utf8')).toContain('<link rel="canonical" href="/demo/terms" />')
    expect(existsSync(join(dir, 'sitemap.xml'))).toBe(false)
  })
})
