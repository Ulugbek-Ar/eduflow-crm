import { readFileSync } from 'node:fs'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { resolveBrand } from './src/constants/brand.ts'
import type { Brand } from './src/constants/brand.ts'

// CSP uchun yagona manba — vercel.json (netlify.toml bilan mosligi tests/deploy-config.test.ts da tekshiriladi).
// `npm run preview` ham shu sarlavhani yuboradi: build'ni prod sharoitida tekshirish mumkin
function readCsp(): string {
  const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: Array<{ headers: Array<{ key: string; value: string }> }>
  }
  const header = vercel.headers.flatMap((rule) => rule.headers).find((h) => h.key === 'Content-Security-Policy')
  if (!header) throw new Error('vercel.json da Content-Security-Policy topilmadi')
  return header.value
}

// Saytning to'liq manzili (og:url, canonical, og:image uchun). Vercel'da avtomatik; boshqa joyda VITE_SITE_URL bilan
function siteUrl(): string {
  const explicit = process.env.VITE_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  return vercel ? `https://${vercel}` : ''
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Brend (src/constants/brand.ts, VITE_BRAND_*) -> index.html: sarlavha, tavsif, favicon, iPhone belgisi, og:image.
// Ilovadagi BRAND bilan bir xil resolveBrand() — nom kodda takrorlanmaydi.
// "pre": yo'llar Vite'ga brend qiymati bilan yetadi (pastki papkada base prefiksi to'g'ri qo'shiladi).
// "post": sayt manzili ma'lum bo'lsa — canonical va og:url, og:image to'liq manzilga (ijtimoiy tarmoqlar nisbiyni o'qimaydi)
function brandMeta(brand: Brand): Plugin[] {
  return [
    {
      name: 'brand-meta',
      transformIndexHtml: {
        order: 'pre',
        handler: (html: string) =>
          html
            .replaceAll('%APP_NAME%', escapeHtml(brand.name))
            .replaceAll('%APP_DESCRIPTION%', escapeHtml(brand.description))
            .replaceAll('%BRAND_FAVICON_TYPE%', faviconType(brand.favicon))
            .replaceAll('%BRAND_FAVICON%', escapeHtml(brand.favicon))
            .replaceAll('%BRAND_APPLE_ICON%', escapeHtml(brand.appleIcon))
            .replaceAll('%BRAND_OG_IMAGE%', escapeHtml(brand.ogImage)),
      },
    },
    {
      name: 'site-url-meta',
      transformIndexHtml: {
        order: 'post',
        handler: (html: string) => {
          const url = siteUrl()
          if (!url) return html
          return html
            .replace(/(<meta property="og:image" content=")(\/[^"]*)"/, (_match: string, head: string, path: string) => `${head}${url}${path}"`)
            .replace('<meta property="og:type"', `<link rel="canonical" href="${url}/" />\n    <meta property="og:url" content="${url}/" />\n    <meta property="og:type"`)
        },
      },
    },
  ]
}

const faviconType = (path: string) => {
  const lower = path.toLowerCase()
  if (lower.endsWith('.svg') || lower.startsWith('data:image/svg')) return 'image/svg+xml'
  if (lower.endsWith('.ico')) return 'image/x-icon'
  return 'image/png'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env, .env.local va muhit o'zgaruvchilari (Vercel/GitHub) — ilovaga ham shu qiymatlar boradi
  const brand = resolveBrand(loadEnv(mode, process.cwd(), 'VITE_BRAND_'))
  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), ...brandMeta(brand)],
    preview: {
      headers: { 'Content-Security-Policy': readCsp() },
    },
  }
})
