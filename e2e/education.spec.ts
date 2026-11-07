import { expect, goTo, isMobile, noHorizontalScroll, registerCenter, skipTour, test } from './fixtures'

// Sozlamadagi standart formatda (kk.oo.yyyy)
const dmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

// Asosiy o'quv oqimi: guruh yaratish → o'quvchi qo'shish → davomat → qarz → to'lov → qarz yopiladi
test('guruh → o\'quvchi → davomat → to\'lov → qarz yopiladi', async ({ page, consoleErrors }) => {
  await registerCenter(page)
  await page.getByRole('button', { name: 'Keyingi' }).click()
  await page.getByRole('button', { name: 'Ingliz tili' }).click()
  await page.getByLabel('Oylik narx').fill('650000')
  await page.getByRole('button', { name: "Qo'shish" }).click()
  await page.getByRole('button', { name: 'Keyingi' }).click()
  await page.getByRole('button', { name: "O'tkazib yuborish" }).click()
  await page.getByRole('button', { name: 'Boshlash' }).click()
  await skipTour(page)

  // Lid
  await goTo(page, 'Mijozlar va lidlar')
  await page.getByRole('button', { name: 'Yangi mijoz' }).first().click()
  const customerForm = page.getByRole('dialog', { name: 'Yangi mijoz' })
  await customerForm.getByLabel(/Ism familiya/).fill('Aziza Karimova')
  await customerForm.getByLabel(/Telefon/).fill('901234567')
  await customerForm.getByRole('button', { name: "Qo'shish" }).click()
  await expect(page.getByText('"Aziza Karimova" mijozlar bazasiga qo\'shildi')).toBeVisible()

  // Guruh: har kuni dars (bugun ham bor)
  await goTo(page, 'Guruhlar')
  await page.getByRole('button', { name: 'Yangi guruh' }).first().click()
  const groupForm = page.getByRole('dialog', { name: 'Yangi guruh' })
  await groupForm.getByLabel(/Guruh nomi/).fill('IELTS — kechki')
  for (const day of ['Seshanba', 'Payshanba', 'Shanba', 'Yakshanba']) await groupForm.getByRole('button', { name: day, exact: true }).click()
  await groupForm.getByRole('button', { name: 'Guruh ochish' }).click()

  // Guruh kartasi ochiladi: o'quvchini kechadan boshlab qo'shish (birinchi oy to'lovi muddati — boshlangan kun)
  const drawer = page.getByRole('dialog', { name: 'IELTS — kechki' })
  await expect(drawer).toBeVisible()
  await drawer.getByLabel("O'quvchi qo'shish").fill('Aziza')
  await page.getByRole('option', { name: /Aziza Karimova/ }).click()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  await drawer.getByRole('textbox', { name: 'Boshlanish sanasi' }).fill(dmy(yesterday))
  await drawer.getByRole('button', { name: "Qo'shish", exact: true }).click()
  // Lid guruhga qo'shilsa — "To'lov qildi" bosqichiga o'tadi (tasdiq)
  await page.getByRole('alertdialog').getByRole('button', { name: "Qo'shish" }).click()
  await expect(page.getByText('Aziza Karimova "IELTS — kechki" guruhiga qo\'shildi')).toBeVisible()
  await expect(drawer.getByRole('tab', { name: "O'quvchilar (1)" })).toBeVisible()

  // Davomat: bugungi dars — "Hammasi keldi"
  await drawer.getByRole('tab', { name: 'Davomat' }).click()
  await drawer.getByRole('button', { name: 'Hammasi keldi' }).click()
  await expect(drawer.getByRole('button', { name: 'Hammasi keldi' })).toHaveCount(0)
  if (isMobile(page)) await expect(drawer.getByRole('group', { name: 'Aziza Karimova: davomat' }).getByRole('button', { name: 'Keldi' })).toHaveAttribute('aria-pressed', 'true')
  else await expect(drawer.locator('button.att-cell', { hasText: 'P' })).toHaveCount(1)
  await noHorizontalScroll(page)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)

  // Qarz: birinchi oy (boshlangan kun o'tdi) — 650 000; to'lov formasi guruh va qoldiq bilan to'ladi
  await goTo(page, 'Moliya va kassa')
  const debts = page.getByRole('table', { name: 'Qarzdorlar' })
  const row = debts.getByRole('row').filter({ hasText: 'Aziza Karimova' })
  await expect(row).toContainText('IELTS — kechki')
  await expect(row).toContainText(/650\s000/)
  await row.getByRole('button', { name: "Aziza Karimova: to'lov qabul qilish" }).click()
  const pay = page.getByRole('dialog', { name: "To'lov qabul qilish" })
  await expect(pay.getByLabel('Guruh')).toHaveValue(/.+/)
  await expect(pay.getByLabel('Guruh').locator('option:checked')).toHaveText('IELTS — kechki')
  await expect(pay.getByLabel(/Summa/)).toHaveValue(/^650\s000$/)
  await pay.getByRole('button', { name: 'Saqlash' }).click()
  await expect(page.getByText("Qarzdorlik yo'q — barcha o'quvchilar muddatida to'lagan.")).toBeVisible()

  // Chekda guruh ko'rinadi
  await page.getByRole('region', { name: 'Bildirishnomalar' }).getByRole('button', { name: 'Chek' }).click()
  const receipt = page.getByRole('dialog', { name: "To'lov cheki" })
  await expect(receipt.getByText('IELTS — kechki')).toBeVisible()
  await page.keyboard.press('Escape')
  await noHorizontalScroll(page)
  expect(consoleErrors).toEqual([])
})
