import { expect, noHorizontalScroll, test } from './fixtures'

test('landing: sarlavha, narxlar, huquqiy sahifalar, gorizontal siljish yo\'q', async ({ page, consoleErrors }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: "O'quv markazingizni bitta panelda boshqaring" })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Narxlar' }).getByRole('article')).toHaveCount(3)
  await noHorizontalScroll(page)
  await page.getByRole('link', { name: 'Maxfiylik siyosati' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Maxfiylik siyosati' })).toBeVisible()
  await noHorizontalScroll(page)
  expect(consoleErrors).toEqual([])
})

test('"Demo\'ni ko\'rish" — demo markaz, haqiqiy ma\'lumotga tegmaydi, chiqishda tozalanadi', async ({ page, consoleErrors }) => {
  await page.goto('/')
  await page.getByRole('main').getByRole('link', { name: /Demo'ni ko'rish/ }).first().click()
  await expect(page.getByRole('region', { name: 'Demo rejim' })).toBeVisible()
  await expect(page).toHaveURL(/\/app$/)
  const keys = await page.evaluate(() => Object.keys(localStorage))
  expect(keys.some((k) => k.startsWith('eduflow-demo:customers'))).toBe(true)
  expect(keys).not.toContain('apex:customers')
  await page.getByRole('region', { name: 'Demo rejim' }).getByRole('button', { name: /Demo'dan chiqish|Chiqish/ }).click()
  // Bu brauzerda haqiqiy markaz hali yo'q — ro'yxatdan o'tish ekrani
  await expect(page.getByRole('button', { name: 'Hisob yaratish' })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('eduflow-demo:')))).toBe(false)
  expect(consoleErrors).toEqual([])
})

test('rus tili: tanlangach butun sahifa ruscha', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Русский' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Управляйте учебным центром в одной панели' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await page.goto('/app')
  await expect(page.getByRole('button', { name: 'Создать учётную запись' })).toBeVisible()
})
