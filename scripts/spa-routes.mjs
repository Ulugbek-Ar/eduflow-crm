// Build'dan keyin: har bir sahifa (/app, /privacy, /terms, /owner) uchun alohida <papka>/index.html nusxasi va sitemap.xml.
// Nega kerak: statik hostingda (GitHub Pages) /eduflow-crm/app so'rovi fayl topmasa 404.html qaytaradi — HTTP 404 status bilan.
// Brauzer konsolida xato chiqadi, qidiruv tizimlari sahifani indekslamaydi. Haqiqiy fayl bo'lsa — 200.
//
// Ishlatish: node scripts/spa-routes.mjs [--out dist] [--base /] [--pages]
//   --pages — GitHub Pages uchun: 404.html (SPA zaxira sahifasi) va .nojekyll; manzillar "/" bilan tugaydi
//             (Pages papka manzilini /app -> /app/ ga 301 bilan yo'naltiradi — canonical yo'naltirishsiz bo'lsin)
// Sayt manzili (canonical, og:url, sitemap): VITE_SITE_URL yoki Vercel'da VERCEL_PROJECT_PRODUCTION_URL (vite.config.ts bilan bir xil)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const APP_NAME = 'EduFlow CRM'

// title — HTML yuklanib, React o'z sarlavhasini qo'yguncha ko'rinadi (va qidiruv natijasida)
export const SPA_ROUTES = [
  { path: 'app', title: `Kirish · ${APP_NAME}`, noindex: true },
  { path: 'privacy', title: `Maxfiylik siyosati · ${APP_NAME}`, noindex: false },
  { path: 'terms', title: `Foydalanish shartlari · ${APP_NAME}`, noindex: false },
  { path: 'owner', title: `Sotuvchi paneli · ${APP_NAME}`, noindex: true },
]

// Qidiruvga ochiq sahifalar (sitemap.xml)
export const PUBLIC_PATHS = ['', 'privacy', 'terms']

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index > 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

export function siteUrlFromEnv(env = process.env) {
  const explicit = env.VITE_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  return vercel ? `https://${vercel}` : ''
}

function normalizeBase(base) {
  const withLead = base.startsWith('/') ? base : `/${base}`
  return withLead.endsWith('/') ? withLead : `${withLead}/`
}

const escapeAttr = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

// Sahifa manzili: sayt manzili ma'lum bo'lsa — to'liq, aks holda domen ichidagi yo'l (base bilan)
function pageUrl(siteUrl, base, path, trailingSlash) {
  const tail = trailingSlash && path ? `${path}/` : path
  return siteUrl ? `${siteUrl}/${tail}` : `${base}${tail}`
}

export function pageHtml(indexHtml, route, { base, siteUrl, trailingSlash = false }) {
  const url = escapeAttr(pageUrl(siteUrl, base, route.path, trailingSlash))
  let html = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(route.title)}</title>`)
  const head = route.noindex ? '<meta name="robots" content="noindex" />\n    ' : ''
  if (/<link rel="canonical"[^>]*>/.test(html)) {
    html = html
      .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
      .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
  } else {
    html = html.replace('<meta property="og:type"', `<link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n    <meta property="og:type"`)
  }
  html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeAttr(route.title)}" />`)
  return html.replace('<meta name="viewport"', `${head}<meta name="viewport"`)
}

export function sitemapXml(siteUrl, trailingSlash = false) {
  const urls = PUBLIC_PATHS.map((path) => `  <url><loc>${pageUrl(siteUrl, '/', path, trailingSlash)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function writeSpaRoutes({ outDir, base = '/', siteUrl = '', pages = false }) {
  const normalizedBase = normalizeBase(base)
  const indexPath = join(outDir, 'index.html')
  if (!existsSync(indexPath)) throw new Error(`${indexPath} topilmadi — avval vite build`)
  const indexHtml = readFileSync(indexPath, 'utf8')
  const written = []
  for (const route of SPA_ROUTES) {
    mkdirSync(join(outDir, route.path), { recursive: true })
    const target = join(outDir, route.path, 'index.html')
    writeFileSync(target, pageHtml(indexHtml, route, { base: normalizedBase, siteUrl, trailingSlash: pages }))
    written.push(target)
  }
  if (pages) {
    // Noma'lum manzil: SPA o'zi hal qiladi (landing), status esa haqiqiy 404
    writeFileSync(join(outDir, '404.html'), indexHtml)
    writeFileSync(join(outDir, '.nojekyll'), '')
    written.push(join(outDir, '404.html'))
  }
  if (siteUrl) {
    writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml(siteUrl, pages))
    written.push(join(outDir, 'sitemap.xml'))
    // robots.txt faqat domen ildizida ishlaydi (Vercel). Pastki papkada (GitHub Pages) qidiruv tizimlari uni o'qimaydi
    const robots = join(outDir, 'robots.txt')
    if (normalizedBase === '/' && existsSync(robots)) {
      const text = readFileSync(robots, 'utf8')
      if (!text.includes('Sitemap:')) writeFileSync(robots, `${text.trimEnd()}\nSitemap: ${siteUrl}/sitemap.xml\n`)
    }
  }
  return written
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outDir = arg('out', 'dist')
  const base = arg('base', '/')
  const siteUrl = siteUrlFromEnv()
  const written = writeSpaRoutes({ outDir, base, siteUrl, pages: process.argv.includes('--pages') })
  console.log(`spa-routes: ${written.length} ta fayl (${outDir}, base ${normalizeBase(base)})${siteUrl ? '' : ' — sayt manzili berilmagan: sitemap.xml yozilmadi'}`)
}
