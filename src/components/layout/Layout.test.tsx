// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '../../constants/navigation'
import { SIDEBAR_COLLAPSED_KEY } from '../../context/DashboardContext'
import { renderSignedIn } from '../../test/helpers'

describe('Layout: sidebar, profil menyusi, mavzu', () => {
  it('sidebar bo\'limlari kerakli tartibda', async () => {
    await renderSignedIn()
    const nav = screen.getByRole('navigation', { name: 'Bo\'limlar' })
    const labels = within(nav).getAllByRole('button').map((b) => b.textContent)
    expect(labels).toEqual([
      'Umumiy ko\'rinish',
      'Mijozlar va lidlar',
      'Moliya va kassa',
      'Kurslar va xizmatlar',
      'Tahlil va hisobotlar',
      'Boshqaruv',
      'Sozlamalar',
    ])
    expect(labels).toEqual(NAV_ITEMS.map((item) => item.label))
  })

  it('kuzatuvchi va menejer menyusida faqat ruxsat berilgan bo\'limlar', async () => {
    const { unmount } = await renderSignedIn(undefined, { role: 'viewer' })
    const labels = () => within(screen.getByRole('navigation', { name: 'Bo\'limlar' })).getAllByRole('button').map((b) => b.textContent)
    expect(labels()).not.toContain('Boshqaruv')
    expect(labels()).toContain('Tahlil va hisobotlar')
    unmount()
    sessionStorage.clear()
    await renderSignedIn(undefined, { role: 'manager' })
    expect(labels()).toEqual(['Umumiy ko\'rinish', 'Mijozlar va lidlar', 'Moliya va kassa', 'Kurslar va xizmatlar', 'Sozlamalar'])
  })

  it('sidebar yig\'iladi, nomlar tooltip va ekran o\'quvchi uchun qoladi, holat saqlanadi', async () => {
    const { user, unmount } = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Menyuni yig\'ish' }))
    const sidebar = screen.getByRole('complementary', { name: 'Asosiy menyu' })
    expect(sidebar.className).toContain('is-collapsed')
    expect(screen.getByRole('button', { name: 'Moliya va kassa' }).getAttribute('data-tooltip')).toBe('Moliya va kassa')
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('true')

    unmount()
    await renderSignedIn()
    expect(screen.getByRole('complementary', { name: 'Asosiy menyu' }).className).toContain('is-collapsed')
    expect(screen.getByRole('button', { name: 'Menyuni kengaytirish' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('profil menyusida ism, rol, "Profil" va "Chiqish"', async () => {
    const { user } = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: /^Profil:/ }))
    const menu = screen.getByRole('menu', { name: 'Profil menyusi' })
    expect(within(menu).getByText('Dilshod Karimov')).toBeTruthy()
    expect(within(menu).getByText('Login: direktor')).toBeTruthy()
    expect(within(menu).getByText(/Direktor · Administrator/)).toBeTruthy()

    await user.click(within(menu).getByRole('menuitem', { name: /Profil/ }))
    expect(await screen.findByRole('region', { name: 'Profil va xavfsizlik' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^Profil:/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Chiqish' }))
    expect(await screen.findByRole('button', { name: 'Kirish' })).toBeTruthy()
  })

  it('profil ismi va lavozimi xodim yozuvida saqlanadi va menyuda ko\'rinadi', async () => {
    const { user } = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    const profile = await screen.findByRole('region', { name: 'Profil va xavfsizlik' })
    await user.clear(within(profile).getByLabelText(/To'liq ism/))
    await user.type(within(profile).getByLabelText(/To'liq ism/), 'Aziz Rahimov')
    await user.clear(within(profile).getByLabelText('Lavozim'))
    await user.type(within(profile).getByLabelText('Lavozim'), 'Direktor o\'rinbosari')
    await user.click(within(profile).getByRole('button', { name: 'Profilni saqlash' }))
    expect(await screen.findByText('Profil saqlandi')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Profil: Aziz Rahimov' }).textContent).toContain('AR')
    const users = JSON.parse(localStorage.getItem('apex:users') ?? '[]') as Array<{ fullName: string; title: string }>
    expect(users[0]).toMatchObject({ fullName: 'Aziz Rahimov', title: 'Direktor o\'rinbosari' })
  })

  it('mavzu bitta tugma bilan almashadi va saqlanadi, "Tizim" sozlamalarda tanlanadi', async () => {
    const { user } = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Qorong\'i mavzuga o\'tish' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('apex:theme')).toBe('"dark"')
    await user.click(screen.getByRole('button', { name: 'Yorug\' mavzuga o\'tish' }))
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    await user.selectOptions(await screen.findByLabelText('Mavzu'), 'system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('apex:theme')).toBe('"system"')
  })
})
