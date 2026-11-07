// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeCustomer, makeTransaction, renderSignedIn } from '../../test/helpers'

const data = { customers: [makeCustomer()], transactions: [makeTransaction()] }

describe('Header va pastki menyu', () => {
  it('davr tanlovi faqat Bosh sahifa, Moliya va Tahlilda', async () => {
    const { user } = await renderSignedIn(data)
    const period = () => screen.queryByRole('group', { name: 'Davr' })
    expect(period()).toBeTruthy()
    for (const [section, visible] of [
      ['Mijozlar va lidlar', false],
      ['Moliya va kassa', true],
      ['Kurslar va xizmatlar', false],
      ['Tahlil va hisobotlar', true],
      ['Boshqaruv', false],
      ['Sozlamalar', false],
    ] as const) {
      await user.click(screen.getByRole('button', { name: section }))
      await screen.findByRole('heading', { name: section, level: 1 })
      expect(Boolean(period())).toBe(visible)
    }
  })

  it('"Qo\'shish" menyusi rolga qarab: menejerda xarajat va kurs yo\'q (guruh bor)', async () => {
    const { user } = await renderSignedIn(data, { role: 'manager' })
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: /^Qo'shish/ }))
    const menu = screen.getByRole('menu', { name: 'Qo\'shish' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.querySelector('span')?.firstChild?.textContent)).toEqual(['Yangi mijoz', 'Yangi guruh', 'To\'lov qabul qilish'])
    await user.click(within(menu).getByRole('menuitem', { name: /To'lov qabul qilish/ }))
    expect(await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })).toBeTruthy()
  })

  it('kuzatuvchida "Qo\'shish" umuman yo\'q', async () => {
    await renderSignedIn(data, { role: 'viewer' })
    expect(screen.queryByRole('button', { name: /^Qo'shish/ })).toBeNull()
  })

  it('pastki menyu: bo\'limlar, "Qo\'shish" oynasi va to\'liq menyu', async () => {
    const { user } = await renderSignedIn(data)
    const nav = screen.getByRole('navigation', { name: 'Pastki menyu' })
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Asosiy', 'Mijozlar', 'Qo\'shish', 'Moliya', 'Menyu'])
    await user.click(within(nav).getByRole('button', { name: 'Moliya' }))
    expect(await screen.findByRole('heading', { name: 'Moliya va kassa', level: 1 })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: 'Moliya' }).getAttribute('aria-current')).toBe('page')

    await user.click(within(nav).getByRole('button', { name: 'Qo\'shish' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nima qo\'shamiz?' })
    await user.click(within(sheet).getByRole('button', { name: /Yangi mijoz/ }))
    expect(await screen.findByRole('dialog', { name: 'Yangi mijoz' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Nima qo\'shamiz?' })).toBeNull()
  })

  it('telefonda filtrlar tugma ortida, faol filtrlar soni ko\'rinadi', async () => {
    const { user } = await renderSignedIn(data)
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    const toggle = await screen.findByRole('button', { name: 'Filtrlar' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Holat' }), 'paid')
    expect(screen.getByRole('button', { name: 'Filtrlar (1)' })).toBeTruthy()
  })
})

describe('Atamalar izohi', () => {
  it('"?" bosilganda oddiy tushuntirish, Esc bilan yopiladi', async () => {
    const { user } = await renderSignedIn(data)
    await user.click(screen.getByRole('button', { name: 'Konversiya nima?' }))
    expect(screen.getByRole('status', { name: '' }).textContent).toContain('100 ta liddan nechtasi to\'lov qilgani')
    await user.keyboard('{Escape}')
    expect(screen.queryByText(/100 ta liddan nechtasi/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Lid nima?' })).toBeTruthy()
  })
})

describe('Forma qoralamasi', () => {
  it('yangi mijoz formasi yopilsa ham yozilgan narsa qoladi; saqlangach o\'chadi', async () => {
    const { user } = await renderSignedIn(data)
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Yangi mijoz' }))
    let dialog = await screen.findByRole('dialog', { name: 'Yangi mijoz' })
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Jasur Toshev')
    await user.click(within(dialog).getByRole('button', { name: 'Bekor qilish' }))

    await user.click(screen.getByRole('button', { name: 'Yangi mijoz' }))
    dialog = await screen.findByRole('dialog', { name: 'Yangi mijoz' })
    expect(within(dialog).getByText(/qoralama tiklandi/)).toBeTruthy()
    expect((within(dialog).getByLabelText(/Ism familiya/) as HTMLInputElement).value).toBe('Jasur Toshev')

    await user.type(within(dialog).getByLabelText(/Telefon/), '935554433')
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
    await screen.findByText('"Jasur Toshev" mijozlar bazasiga qo\'shildi')
    expect(localStorage.getItem('apex:draft:customer')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Yangi mijoz' }))
    dialog = await screen.findByRole('dialog', { name: 'Yangi mijoz' })
    expect(within(dialog).queryByText(/qoralama tiklandi/)).toBeNull()
    expect((within(dialog).getByLabelText(/Ism familiya/) as HTMLInputElement).value).toBe('')
  })

  it('"Tozalash" qoralamani o\'chiradi; tahrirlashda qoralama ishlatilmaydi', async () => {
    localStorage.setItem('apex:draft:customer', JSON.stringify({ name: 'Eski qoralama', phone: 123 }))
    const { user } = await renderSignedIn(data)
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Yangi mijoz' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi mijoz' })
    // Noto'g'ri turdagi maydon (phone: 123) e'tiborsiz qoldiriladi
    expect((within(dialog).getByLabelText(/Telefon/) as HTMLInputElement).value).toBe('+998')
    await user.click(within(dialog).getByRole('button', { name: 'Tozalash' }))
    expect((within(dialog).getByLabelText(/Ism familiya/) as HTMLInputElement).value).toBe('')
    expect(localStorage.getItem('apex:draft:customer')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Bekor qilish' }))

    await user.click(screen.getByRole('button', { name: 'Aziza Karimovani tahrirlash' }))
    const edit = await screen.findByRole('dialog', { name: 'Mijozni tahrirlash' })
    expect(within(edit).queryByText(/qoralama/)).toBeNull()
  })
})
