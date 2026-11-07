import { expect, goTo, isMobile, noHorizontalScroll, skipTour, test } from './fixtures'

// O'qituvchi sifatida kirish: faqat o'z guruhlari, jadvali va davomati; mijozlar va moliya yopiq
test('o\'qituvchi: faqat o\'z guruhlari va davomatni belgilash', async ({ page, consoleErrors }) => {
  await page.goto('/app?demo=1')
  await skipTour(page)
  await page.getByRole('region', { name: 'Demo rejim' }).getByRole('combobox').selectOption({ label: 'O\'qituvchi' })
  await skipTour(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Bugun' })).toBeVisible()
  // Menyu: Bugun, Guruhlarim, Davomat ...; mijozlar va moliya yo'q
  if (isMobile(page)) {
    const bottom = page.getByRole('navigation', { name: 'Pastki menyu' })
    await expect(bottom.getByRole('button', { name: 'Guruhlarim' })).toBeVisible()
    await expect(bottom.getByRole('button', { name: 'Davomat' })).toBeVisible()
    await expect(bottom.getByRole('button', { name: 'Mijozlar' })).toHaveCount(0)
    await bottom.getByRole('button', { name: 'Menyu' }).click()
  }
  const nav = page.locator('.sidebar-nav')
  await expect(nav.getByRole('button', { name: 'Mijozlar va lidlar' })).toHaveCount(0)
  await expect(nav.getByRole('button', { name: 'Moliya va kassa' })).toHaveCount(0)
  await nav.getByRole('button', { name: 'Guruhlarim', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Guruhlarim' })).toBeVisible()
  // Demo o'qituvchi Nodira Saidova — faqat ikkita IELTS guruhi
  const groupButtons = page.locator('table .link-btn')
  await expect(groupButtons).toHaveCount(2)
  await expect(groupButtons.filter({ hasText: 'IELTS' })).toHaveCount(2)
  await noHorizontalScroll(page)

  // Davomat: bugungi yoki oxirgi kunlardagi dars — katta tugmalar
  await goTo(page, 'Davomat')
  const first = page.locator('.lesson-student').first()
  await first.getByRole('button', { name: 'Kelmadi' }).click()
  await expect(first.getByRole('button', { name: 'Kelmadi' })).toHaveAttribute('aria-pressed', 'true')
  await first.getByRole('button', { name: 'Keldi' }).click()
  await expect(first.getByRole('button', { name: 'Keldi' })).toHaveAttribute('aria-pressed', 'true')
  await noHorizontalScroll(page)
  expect(consoleErrors).toEqual([])
})

test('administrator: guruh kartasida oylik davomat setkasi, klaviatura bilan belgilash', async ({ page, consoleErrors }) => {
  test.skip(isMobile(page), 'setka — kompyuterda; telefonda dars bo\'yicha ro\'yxat')
  await page.goto('/app?demo=1')
  await skipTour(page)
  await goTo(page, 'Guruhlar')
  await page.locator('table .link-btn').filter({ hasText: 'IELTS — kechki' }).click()
  const drawer = page.getByRole('dialog', { name: 'IELTS — kechki' })
  await drawer.getByRole('tab', { name: 'Davomat' }).click()
  const grid = drawer.locator('table.att-grid')
  await expect(grid).toBeVisible()
  const cell = grid.locator('button.att-cell:not([disabled])').first()
  await cell.focus()
  await page.keyboard.press('a')
  await expect(cell).toHaveText('A')
  await page.keyboard.press('p')
  await expect(cell).toHaveText('P')
  expect(consoleErrors).toEqual([])
})
