import { defineConfig, devices } from '@playwright/test'

// E2E: build qilingan sayt `vite preview` da (prod CSP sarlavhasi bilan) tekshiriladi.
// Lokal: npm run e2e (oldin npm run build). CI: .github/workflows/ci.yml
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
    locale: 'uz-UZ',
    // Oldindan o'rnatilgan brauzer bo'lsa (masalan, bulutli muhit) — shuni ishlatadi
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npx vite preview --port 4174 --strictPort',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    // GitHub Pages taqlidi (e2e/pages.spec.ts): namoyish build'i /eduflow-crm/ ostida, yo'q fayl — 404.html (404 status)
    {
      command: 'npm run build:pages && node scripts/pages-server.mjs --dir site --base /eduflow-crm/ --port 4175',
      url: 'http://localhost:4175/eduflow-crm/',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_DEMO_ONLY: '1',
        VITE_SITE_URL: 'https://ulugbek-ar.github.io/eduflow-crm',
        VITE_SUPPORT_TELEGRAM: '@eduflow_uz',
        VITE_SUPPORT_PHONE: '+998 90 000 00 00',
        VITE_MAIN_SITE_URL: '',
      },
    },
  ],
})
