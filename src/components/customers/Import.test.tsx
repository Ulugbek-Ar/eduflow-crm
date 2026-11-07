// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { readAudit } from '../../services/audit.service'
import { makeCustomer, plain, renderSignedIn } from '../../test/helpers'

const stored = <T,>(key: string) => JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
type Row = { id: string; name: string; phone: string; course: string; status: string; note?: string }

// Rus tilidagi sarlavhalar; 2-qator bazada bor, 3-qator fayl ichida takror, 4-qator — noto'g'ri telefon, Python — yangi kurs
const CSV = [
  'ФИО;Телефон;Курс;Статус',
  'Bobur Aliyev;998931112233;Ingliz tili (IELTS);Оплатил',
  'Aziza;+998 90 123 45 67;;',
  'Bobur ikkinchi;93 111 22 33;;',
  'Kamola;12345;;',
  'Jasur Karimov;945556677;Python;думает',
].join('\r\n')

async function openImport() {
  const view = await renderSignedIn({ customers: [makeCustomer()] })
  await view.user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
  await view.user.click(await screen.findByRole('button', { name: 'Import' }))
  const dialog = await screen.findByRole('dialog', { name: 'Mijozlarni import qilish' })
  await view.user.upload(within(dialog).getByLabelText(/Faylni tanlang/), new File([CSV], 'mijozlar.csv', { type: 'text/csv' }))
  await within(dialog).findByRole('group', { name: 'Ustunlarni moslashtirish' })
  return { ...view, dialog }
}

describe('Mijozlarni import qilish', () => {
  it('ustunlar avtomatik, oldindan ko\'rish va takrorlar; natija, bitta jurnal yozuvi va bekor qilish', async () => {
    const { user, dialog } = await openImport()
    expect((within(dialog).getByLabelText('Ism familiya *') as HTMLSelectElement).value).toBe('0')
    expect((within(dialog).getByLabelText('Telefon *') as HTMLSelectElement).value).toBe('1')
    expect((within(dialog).getByLabelText('Kurs') as HTMLSelectElement).value).toBe('2')
    expect((within(dialog).getByLabelText('Holat') as HTMLSelectElement).value).toBe('3')
    expect(plain(within(dialog).getByRole('status').textContent)).toBe('Jami 5 qator: 2 ta qo\'shiladi, 0 ta yangilanadi, 3 ta o\'tkazib yuboriladi (shundan xato: 1)')
    const preview = within(dialog).getByRole('region', { name: /Oldindan ko'rish/ })
    expect(within(preview).getByText('Bazada bor: Aziza Karimova')).toBeTruthy()
    expect(within(preview).getByText('Fayl ichida takror (2-qator)')).toBeTruthy()
    expect(within(preview).getByText('Telefon noto\'g\'ri: 12345')).toBeTruthy()
    expect(within(dialog).getByRole('checkbox', { name: /Kurs yaratish: «Python»/ })).toHaveProperty('checked', true)

    await user.click(within(dialog).getByRole('button', { name: 'Import qilish (2)' }))
    const result = within(dialog).getByRole('status')
    expect(plain(result.textContent)).toBe('Qo\'shildi2Yangilandi0O\'tkazib yuborildi3')
    expect(stored<Row>('apex:customers').map((c) => [c.name, c.phone, c.course, c.status])).toEqual([
      ['Bobur Aliyev', '+998 93 111 22 33', 'Ingliz tili (IELTS)', 'paid'],
      ['Jasur Karimov', '+998 94 555 66 77', 'Python', 'thinking'],
      ['Aziza Karimova', '+998 90 123 45 67', 'Ingliz tili (IELTS)', 'paid'],
    ])
    expect(stored<{ name: string; monthlyPrice: number }>('apex:courses').find((c) => c.name === 'Python')?.monthlyPrice).toBe(0)
    expect(readAudit().filter((e) => e.action.startsWith('import'))).toEqual([expect.objectContaining({ action: 'import.run', summary: 'mijozlar.csv: qo\'shildi 2, yangilandi 0, o\'tkazib yuborildi 3' })])
    expect(within(dialog).getByRole('button', { name: 'O\'tkazilganlar va xatolar (CSV)' })).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Importni bekor qilish' }))
    expect(stored<Row>('apex:customers').map((c) => c.name)).toEqual(['Aziza Karimova'])
    expect(stored<{ name: string }>('apex:courses').some((c) => c.name === 'Python')).toBe(false)
    expect(within(dialog).getByRole('button', { name: 'Import bekor qilindi' })).toHaveProperty('disabled', true)
    expect(readAudit()[0]).toMatchObject({ action: 'import.undo' })
  })

  it('"Yangilash": bazadagi mijoz yangilanadi, kurs yaratilmasa — izohga; bekor qilinganda avvalgi holiga qaytadi', async () => {
    const { user, dialog } = await openImport()
    await user.click(within(dialog).getByRole('button', { name: 'Yangilash' }))
    await user.click(within(dialog).getByRole('checkbox', { name: /Kurs yaratish: «Python»/ }))
    expect(plain(within(dialog).getByRole('status').textContent)).toContain('2 ta qo\'shiladi, 1 ta yangilanadi, 2 ta o\'tkazib yuboriladi')
    await user.click(within(dialog).getByRole('button', { name: 'Import qilish (3)' }))
    const customers = stored<Row>('apex:customers')
    expect(customers.find((c) => c.id === 'c1')?.name).toBe('Aziza')
    expect(customers.find((c) => c.name === 'Jasur Karimov')).toMatchObject({ course: '', note: 'Kurs: Python' })
    expect(stored<{ name: string }>('apex:courses').some((c) => c.name === 'Python')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Importni bekor qilish' }))
    expect(stored<Row>('apex:customers')).toEqual([expect.objectContaining({ id: 'c1', name: 'Aziza Karimova' })])
  })
})
