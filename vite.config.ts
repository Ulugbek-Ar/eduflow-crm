import { readFileSync } from 'node:fs'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { APP_DESCRIPTION, APP_NAME } from './src/constants/app.ts'
import { routePreload } from './scripts/route-preload.ts'

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

// index.html dagi %APP_NAME% / %APP_DESCRIPTION% -> src/constants/app.ts dagi qiymatlar; sayt manzili ma'lum bo'lsa —
// canonical va og:url qo'shiladi, og:image to'liq manzilga aylanadi (ijtimoiy tarmoqlar nisbiy manzilni o'qimaydi)
function appMeta(): Plugin {
  return {
    name: 'app-meta',
    // Vite base bilan yo'llarni o'zgartirgandan keyin ishlaydi (pastki papkada ham to'liq manzil to'g'ri chiqadi)
    transformIndexHtml: { order: 'post', handler: (html) => {
      const url = siteUrl()
      let out = html.replaceAll('%APP_NAME%', APP_NAME).replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION)
      if (url) {
        out = out
          .replace(/content="[^"]*og-image\.jpg"/, `content="${url}/og-image.jpg"`)
          .replace('<meta property="og:type"', `<link rel="canonical" href="${url}/" />\n    <meta property="og:url" content="${url}/" />\n    <meta property="og:type"`)
      }
      return out
    } },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    appMeta(),
    // Sahifa bo'lagi index.js bilan parallel yuklanadi (scripts/route-preload.mjs)
    routePreload(),
  ],
  preview: {
    headers: { 'Content-Security-Policy': readCsp() },
  },
})
