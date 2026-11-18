import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Server hisob yig'masi: src/server/engine.ts -> supabase/functions/_shared/generated/engine.js (Deno import qiladi).
// i18n — lug'atsiz o'rinbosar (brauzer API'lari va rus lug'ati kirmaydi). Yangiligi: scripts/check-engine.mjs
export default defineConfig({
  logLevel: 'warn',
  resolve: {
    alias: [{ find: /^(\.\.\/)+i18n$/, replacement: fileURLToPath(new URL('./src/server/i18n-stub.ts', import.meta.url)) }],
  },
  build: {
    lib: { entry: fileURLToPath(new URL('./src/server/engine.ts', import.meta.url)), formats: ['es'], fileName: () => 'engine.js' },
    outDir: process.env.ENGINE_OUT_DIR ?? 'supabase/functions/_shared/generated',
    // Yonidagi engine.d.ts (qo'lda yozilgan turlar) o'chmasin
    emptyOutDir: false,
    minify: false,
    target: 'es2022',
    copyPublicDir: false,
    reportCompressedSize: false,
  },
})
