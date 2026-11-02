import { readFileSync } from 'node:fs'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { APP_DESCRIPTION, APP_NAME } from './src/constants/app.ts'

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

// index.html dagi %APP_NAME% / %APP_DESCRIPTION% -> src/constants/app.ts dagi qiymatlar
function appMeta(): Plugin {
  return {
    name: 'app-meta',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME).replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    appMeta(),
  ],
  preview: {
    headers: { 'Content-Security-Policy': readCsp() },
  },
})
