import { expect, isMobile, test } from './fixtures'

// GitHub Pages taqlidi (playwright.config.ts dagi 2-server): sayt /eduflow-crm/ ostida, yo'q fayl uchun 404.html — 404 status.
// Deep link'lar haqiqiy fayl bo'lgani uchun 200 qaytaradi va konsolda xato bo'lmaydi
const PAGES = 'http://localhost:4175/eduflow-crm/'

const ROUTES: Array<{ path: string; heading: RegExp; noindex: boolean }> = [
  { path: 'app', heading: /EduFlow CRM/, noindex: true },
  { path: 'privacy', heading: /Maxfiylik siyosati/, noindex: false },
  { path: 'terms', heading: /Foydalanish shartlari/, noindex: false },
  { path: 'owner', heading: /Sotuvchi paneli/, noindex: true },
]

for (const route of ROUTES) {
  test(`Pages: /eduflow-crm/${route.path} — 200, konsolda xato yo'q`, async ({ page, consoleErrors }) => {
    test.skip(isMobile(page), 'kompyuterda yetarli')
    const response = await page.goto(`${PAGES}${route.path}`)
    expect(response?.status()).toBe(200)
    // Sahifa React bilan chizildi (Sotuvchi panelida demo rejimda h1 yo'q — sarlavha header'da)
    await expect(page.getByText(route.heading).first()).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveCount(route.noindex ? 1 : 0)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://ulugbek-ar.github.io/eduflow-crm/${route.path}/`)
    await page.waitForLoadState('networkidle')
    expect(consoleErrors).toEqual([])
  })
}

test('Pages: noma\'lum manzil — 404 status; sitemap.xml bor', async ({ request }) => {
  expect((await request.get(`${PAGES}yoq-sahifa`)).status()).toBe(404)
  const sitemap = await request.get(`${PAGES}sitemap.xml`)
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).toContain('<loc>https://ulugbek-ar.github.io/eduflow-crm/privacy/</loc>')
})

test('Pages: berk ko\'cha yo\'q — demo va ulanish uchun ariza (Telegram xabari)', async ({ page, consoleErrors }) => {
  await page.goto(PAGES)
  const hero = page.getByRole('main').locator('.lp-hero')
  await expect(hero.getByRole('link', { name: /Demo'ni ko'rish/ })).toBeVisible()
  await expect(hero.getByRole('link', { name: /bepul sinash/ })).toHaveCount(0)
  await hero.getByRole('button', { name: 'Ulanish uchun ariza' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ulanish uchun ariza' })
  await dialog.getByRole('button', { name: 'Davom etish' }).click()
  await expect(dialog.getByText('Ismingizni kiriting')).toBeVisible()
  await dialog.getByLabel(/Ismingiz/).fill('Dilshod Karimov')
  await dialog.getByLabel(/Telefon/).fill('901234567')
  await dialog.getByLabel(/O'quv markazi nomi/).fill('Bilim Plus')
  await dialog.getByLabel(/O'quvchilar soni/).fill('120')
  await dialog.getByRole('button', { name: 'Davom etish' }).click()
  await expect(dialog.getByLabel('Xabar matni')).toHaveValue(/\+998 90 123 45 67[\s\S]*Bilim Plus[\s\S]*120/)
  const telegram = dialog.getByRole('link', { name: 'Telegram orqali yuborish' })
  await expect(telegram).toHaveAttribute('href', /^https:\/\/t\.me\/share\/url\?url=.+&text=.+Bilim%20Plus/)
  await expect(dialog.getByRole('link', { name: /Qo'ng'iroq qilish/ })).toHaveAttribute('href', 'tel:+998900000000')
  // Email sozlanmagan — tugma yo'q
  await expect(dialog.getByRole('link', { name: 'Email yozish' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('contentinfo').getByRole('link', { name: '@eduflow_uz' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})
