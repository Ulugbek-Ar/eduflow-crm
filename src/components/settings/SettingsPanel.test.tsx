// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../constants/mockData'
import { makeCustomer, makeTransaction, renderSignedIn } from '../../test/helpers'

async function openSettings(data?: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(data)
  await view.user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
  await screen.findByRole('region', { name: 'Tashkilot' })
  return view
}

const storedSettings = () => JSON.parse(localStorage.getItem('apex:settings') ?? '{}') as Record<string, unknown>

describe('Sozlamalar', () => {
  it('logotip yuklanadi, saqlangach sidebar\'da rasm; olib tashlansa harfli logo qaytadi', async () => {
    const { user } = await openSettings()
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Logotip rasmini tanlash'), file)
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))
    expect(String(storedSettings().logoImage)).toMatch(/^data:image\/png;base64,/)
    const sidebar = screen.getByRole('complementary', { name: 'Asosiy menyu' })
    expect(sidebar.querySelector('img.logo-image')?.getAttribute('src')).toMatch(/^data:image\/png/)

    await user.click(screen.getByRole('button', { name: 'Olib tashlash' }))
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))
    expect(storedSettings().logoImage).toBe('')
    expect(within(sidebar).getByText(DEFAULT_SETTINGS.logoText)).toBeTruthy()
  })

  it('200 KB dan katta yoki rasm bo\'lmagan fayl rad etiladi', async () => {
    const { user } = await openSettings()
    const input = screen.getByLabelText('Logotip rasmini tanlash')
    await user.upload(input, new File([new Uint8Array(201 * 1024)], 'katta.png', { type: 'image/png' }))
    expect(screen.getByRole('alert').textContent).toBe('Rasm hajmi 200 KB dan oshmasligi kerak (hozir 201 KB)')
    // accept atributini chetlab o'tib yuklash (masalan, "Barcha fayllar" tanlansa)
    fireEvent.change(input, { target: { files: [new File(['salom'], 'matn.txt', { type: 'text/plain' })] } })
    expect((await screen.findByRole('alert')).textContent).toBe('Faqat PNG, JPG, WEBP, GIF yoki SVG rasm')
  })

  it('"O\'quv jarayoni": to\'lov muddati, birinchi oy ulushi va eslatma shablonlari (bo\'sh shablon — standart matn)', async () => {
    const { user } = await openSettings()
    const card = screen.getByRole('region', { name: 'O\'quv jarayoni' })
    const due = within(card).getByLabelText('Oylik to\'lov muddati (oyning sanasi)')
    await user.clear(due)
    await user.type(due, '5')
    await user.click(within(card).getByRole('checkbox', { name: /Birinchi oyni kunlar bo'yicha hisoblash/ }))
    await user.clear(within(card).getByLabelText('To\'lov eslatmasi shabloni (o\'zbekcha)'))
    fireEvent.change(within(card).getByLabelText('To\'lov eslatmasi shabloni (ruscha)'), { target: { value: 'Оплата {summa}' } })
    expect(within(card).getByText(/O'zgaruvchilar: \{ism\} \{summa\}/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))
    expect(storedSettings()).toMatchObject({ paymentDueDay: 5, prorateFirstMonth: true, reminderTemplateRu: 'Оплата {summa}' })
    expect(String(storedSettings().reminderTemplateUz)).toContain('Assalomu alaykum, {ism}!')
  })

  it('"Asosiy valyuta": UZS / USD', async () => {
    const { user } = await openSettings()
    const select = screen.getByLabelText('Asosiy valyuta')
    expect(within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual(['UZS', 'USD'])
    await user.selectOptions(select, 'USD')
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))
    expect(storedSettings().currency).toBe('USD')
    expect(screen.getByRole('complementary', { name: 'Asosiy menyu' }).textContent).toContain('$')
  })

  it('Reset: tasdiqlangach mijozlar, tranzaksiyalar va kurslar o\'chadi, sozlamalar qoladi', async () => {
    const { user } = await openSettings({ customers: [makeCustomer()], transactions: [makeTransaction()] })
    const data = screen.getByRole('region', { name: 'Ma\'lumotlar' })
    await user.click(within(data).getByRole('button', { name: 'Tozalash' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Barcha ma\'lumotni tozalash' })
    expect(dialog.textContent).toContain('1 ta mijoz, 1 ta tranzaksiya va 8 ta kurs/xizmat')
    await user.click(within(dialog).getByRole('button', { name: 'Hammasini o\'chirish' }))
    expect(localStorage.getItem('apex:customers')).toBe('[]')
    expect(localStorage.getItem('apex:transactions')).toBe('[]')
    expect(localStorage.getItem('apex:courses')).toBe('[]')
    expect(storedSettings().orgName).toBe(DEFAULT_SETTINGS.orgName)
    expect(within(data).getByText(/0 ta mijoz, 0 ta tranzaksiya/)).toBeTruthy()
  })
})
