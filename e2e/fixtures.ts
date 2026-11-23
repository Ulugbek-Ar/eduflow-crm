import { expect, test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

// Har test: konsol xatolari (CSP buzilishi ham) yig'iladi va test oxirida bo'sh bo'lishi tekshiriladi
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await provide(errors)
    expect(errors, 'brauzer konsolida xato bo\'lmasligi kerak').toEqual([])
  },
})

export { expect }

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600

// Bo'limga o'tish: telefonda pastki menyu → "Menyu", kompyuterda sidebar
export async function goTo(page: Page, section: string) {
  if (isMobile(page)) await page.getByRole('navigation', { name: 'Pastki menyu' }).getByRole('button', { name: 'Menyu' }).click()
  await page.locator('.sidebar-nav').getByRole('button', { name: section, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: section })).toBeVisible()
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'gorizontal siljish bo\'lmasligi kerak').toBeLessThanOrEqual(0)
}

// Tanishtiruv oynasi bo'lsa — yopish
export async function skipTour(page: Page) {
  const skip = page.getByRole('button', { name: "O'tkazib yuborish" })
  if (await skip.isVisible().catch(() => false)) await skip.click()
}

export async function registerCenter(page: Page, login = 'direktor', password = 'Toshkent2026') {
  await page.goto('/app')
  await page.getByLabel(/O'quv markazi nomi/).fill('Bilim Plus')
  await page.getByLabel(/Ism familiyangiz/).fill('Dilshod Karimov')
  await page.getByLabel(/^Login/).fill(login)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('input[name="confirm"]').fill(password)
  await page.getByRole('button', { name: 'Hisob yaratish' }).click()
  await expect(page.getByRole('heading', { name: 'Markaz haqida' })).toBeVisible()
}
