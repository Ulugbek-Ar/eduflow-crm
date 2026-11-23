import { readFile } from 'node:fs/promises'
import { expect, goTo, noHorizontalScroll, registerCenter, skipTour, test } from './fixtures'

// 10 qator: 1-qator bazada bor (Aziza), 6-qator fayl ichida takror (Bobur raqami) — 8 ta qo'shiladi, 2 tasi o'tkaziladi
const CSV = [
  'Ism familiya;Telefon;Kurs;Manba;Holat',
  'Aziza Karimova;+998 90 123 45 67;;;',
  'Bobur Aliyev;998931112233;;Instagram;Yangi',
  "Dilnoza Rahimova;93 222 33 44;;Telegram;Bog'lanildi",
  "Jasur Tursunov;(94) 555-66-77;;Tavsiya;To'lov qildi",
  'Kamola Yusupova;+998 95 111 22 33;;Sayt;',
  'Bobur Aliyev 2;+998 93 111 22 33;;;',
  'Laylo Nazarova;97 444 55 66;;;',
  'Otabek Qodirov;998 99 777 88 99;;;',
  'Sevara Islomova;88 123 45 67;;;',
  "Ulug'bek Karimov;+998 33 765 43 21;;;",
].join('\r\n')

test('import: 10 qatorli CSV, 2 ta takror → 8 qo\'shildi, 2 o\'tkazib yuborildi; xatolar CSV', async ({ page, consoleErrors }) => {
  await registerCenter(page)
  await page.getByRole('button', { name: 'Keyinroq sozlayman' }).click()
  await skipTour(page)

  await goTo(page, 'Mijozlar va lidlar')
  await page.getByRole('button', { name: 'Yangi mijoz' }).first().click()
  const form = page.getByRole('dialog', { name: 'Yangi mijoz' })
  await form.getByLabel(/Ism familiya/).fill('Aziza Karimova')
  await form.getByLabel(/Telefon/).fill('901234567')
  await form.getByRole('button', { name: "Qo'shish" }).click()
  await expect(page.getByText('1 ta natija (jami 1)')).toBeVisible()

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Mijozlarni import qilish' })
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'mijozlar.csv', mimeType: 'text/csv', buffer: Buffer.from(`﻿${CSV}`, 'utf8') })
  await expect(dialog.getByRole('group', { name: 'Ustunlarni moslashtirish' })).toBeVisible()
  await expect(dialog.getByRole('status')).toHaveText("Jami 10 qator: 8 ta qo'shiladi, 0 ta yangilanadi, 2 ta o'tkazib yuboriladi")
  await expect(dialog.getByText('Bazada bor: Aziza Karimova')).toBeVisible()
  await expect(dialog.getByText('Fayl ichida takror (3-qator)')).toBeVisible()
  await noHorizontalScroll(page)

  await dialog.getByRole('button', { name: 'Import qilish (8)' }).click()
  const result = dialog.getByRole('status')
  await expect(result).toContainText("Qo'shildi8")
  await expect(result).toContainText('Yangilandi0')
  await expect(result).toContainText("O'tkazib yuborildi2")

  const downloading = page.waitForEvent('download')
  await dialog.getByRole('button', { name: "O'tkazilganlar va xatolar (CSV)" }).click()
  const download = await downloading
  const report = await readFile(await download.path(), 'utf8')
  expect(report).toContain('Bazada bor: Aziza Karimova')
  expect(report).toContain('Fayl ichida takror (3-qator)')

  await dialog.getByRole('button', { name: 'Tayyor' }).click()
  await expect(page.getByText('9 ta natija (jami 9)')).toBeVisible()
  await noHorizontalScroll(page)
  expect(consoleErrors).toEqual([])
})
